import { eq, desc, and, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { randomBytes } from "crypto";
import Anthropic from "@anthropic-ai/sdk";
import { Resend } from "resend";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "../trpc";
import {
  leads, leadOutreach, leadCalls, leadOutcomes, leadDemoViews,
  projects, clients, proposalVersions, followUpSequences, industryProfiles,
  outreachTemplates,
  type ScrapedProfile, type BusinessProfile,
} from "../db/schema";
import { slack } from "@/lib/slack";
import { scrapeWebsite } from "@/lib/scraper";
import { generateBusinessProfile } from "@/lib/businessProfile";
import { sendSms, sendWhatsApp, twilioConfigured } from "@/lib/twilio";
import { uploadHtml } from "@/lib/blob";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const resend = new Resend(process.env.RESEND_API_KEY ?? process.env.AUTH_RESEND_KEY ?? "not_configured");

const leadInput = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  linkedIn: z.string().optional(),
  company: z.string().optional(),
  website: z.string().optional(),
  industry: z.string().optional(),
  companySize: z.string().optional(),
  region: z.string().optional(),
  jobTitle: z.string().optional(),
  techStack: z.string().optional(),
  painPoints: z.string().optional(),
  scrapedData: z.string().optional(),
  notes: z.string().optional(),
  tags: z.array(z.string()).optional(),
  source: z.enum(["csv_import", "manual", "api", "web_scraper"]).optional(),
});

const STATUS_VALUES = ["new", "reviewing", "demo_queued", "demo_generated", "sent", "replied", "won", "lost", "archived"] as const;

function genShareToken(): string {
  return randomBytes(24).toString("base64url");
}

function canonicalDedupKey(input: { email?: string | null; company?: string | null; lastName?: string | null; website?: string | null }): string | null {
  if (input.email) return `email:${input.email.toLowerCase().trim()}`;
  if (input.website) return `web:${input.website.toLowerCase().replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}`;
  if (input.company && input.lastName) return `cl:${input.company.toLowerCase().trim()}|${input.lastName.toLowerCase().trim()}`;
  return null;
}

function buildDemoPrompt({
  companyName, name, jobTitle, industry, offer, targetCustomer, tone,
  weaknesses, brandColors, brandFonts, demoAngle, recommendedFeatures,
}: {
  companyName: string; name: string; jobTitle?: string | null; industry?: string | null;
  offer: string; targetCustomer?: string | null; tone: string; weaknesses: string;
  brandColors: string[]; brandFonts: string[]; demoAngle: string; recommendedFeatures: string;
}): string {
  const primary = brandColors[0] ?? "#7c5cbf";
  const secondary = brandColors[1] ?? "#4f8ef7";
  const accent = brandColors[2] ?? "#0a0a0f";
  const fonts = brandFonts.length > 0 ? brandFonts.join(", ") : "Inter, system-ui";

  return `You are a senior UI engineer and award-winning web designer. Produce a STUNNING, conversion-optimised single-file demo page for a sales prospect. Every pixel must look like it was built by a $300K/yr agency.

BUSINESS CONTEXT
Company: ${companyName}
Industry: ${industry ?? "Technology"}
Contact: ${name}${jobTitle ? ` (${jobTitle})` : ""}
What NexoFlow solves for them: ${offer}
Their target customers: ${targetCustomer ?? "their clients"}
Their tone of voice: ${tone}
Pain points we fix: ${weaknesses || "operational inefficiencies and manual workflows"}
Demo angle: ${demoAngle}
Features to showcase: ${recommendedFeatures}

BRAND
Primary color: ${primary}
Secondary color: ${secondary}
Accent/background tone: ${accent}
Fonts: ${fonts}

MANDATORY DESIGN RULES — follow every one, no exceptions:

1. CSS VARIABLES
   :root {
     --primary: ${primary};
     --secondary: ${secondary};
     --accent: ${accent};
     --bg: /* choose dark (#0d0d14) for bold/tech brands, near-white (#f8f8fc) for premium/light brands */;
     --surface: /* semi-transparent card bg: rgba(255,255,255,0.06) for dark, rgba(0,0,0,0.04) for light */;
     --text: /* #ffffff for dark bg, #111111 for light bg */;
     --text-muted: /* #a0a0b0 for dark, #666677 for light */;
     --radius: 16px;
   }

2. GOOGLE FONTS — import ${fonts.split(",")[0]?.trim()} at top of <style>: @import url('https://fonts.googleapis.com/css2?family=${(fonts.split(",")[0]?.trim() ?? "Inter").replace(/ /g, "+")}:wght@400;600;700;900&display=swap');

3. SECTIONS (in this exact order):
   a. HERO — full-viewport-height, gradient background using --primary → --secondary (135deg), centered content:
      - Pill badge: "Custom demo for ${companyName}" with border: 1px solid rgba(255,255,255,0.2)
      - H1 (72px desktop / 40px mobile, font-weight:900): A powerful, specific headline referencing their exact problem
      - Subheadline (20px, --text-muted): One sentence on the transformation NexoFlow delivers for them
      - Two CTAs side-by-side: primary button (solid --primary, 56px height, border-radius:12px, hover: scale(1.04) + box-shadow), ghost button (border: 2px solid rgba(255,255,255,0.3))
      - Below CTAs: 3 trust micro-stats inline (e.g. "⚡ Built in 6 weeks", "🔒 SOC2-ready", "📈 3× faster") relevant to their industry

   b. PROBLEM — "The challenge ${companyName} faces today" — 3 cards in a CSS grid (repeat(auto-fit, minmax(280px,1fr))):
      - Each card: backdrop-filter:blur(20px), background:var(--surface), border:1px solid rgba(255,255,255,0.08), border-radius:var(--radius)
      - Inline SVG icon (40px, colored --primary), bold problem title, 2-sentence description using THEIR specific pain points

   c. SOLUTION — "What NexoFlow builds for ${companyName}" — same card grid:
      - 3-4 feature cards from recommendedFeatures, each with distinct inline SVG icon
      - Feature title + description written specifically for their business context

   d. STATS BAR — full-width gradient strip (--primary to --secondary), 3 large metrics in a flex row:
      - Numbers must be industry-relevant (e.g. "↓ 70% manual work", "↑ 40% faster ops", "$120K saved/yr")
      - Large number (56px, bold white) + label underneath

   e. HOW IT WORKS — 3-step timeline (horizontal on desktop, vertical on mobile):
      - Step numbers in circles (gradient border), step title + 1-line description

   f. CTA SECTION — full-width, dark background (#080810 or white depending on scheme):
      - Large headline: "Ready to build this for ${companyName}?"
      - Subtext referencing their specific transformation
      - Single large CTA button: "Book a call with NexoFlow →" linking to https://nexoflow.tech
      - Below: "No commitment. 30-min discovery call."

   g. FOOTER — minimal:
      - "Custom demo built for ${companyName} · NexoFlow © 2026"
      - nexoflow.tech link

4. ANIMATIONS — CSS keyframes only:
   @keyframes fadeInUp { from { opacity:0; transform:translateY(24px) } to { opacity:1; transform:translateY(0) } }
   Add this 10-line IntersectionObserver to animate .animate-in elements when they enter the viewport:
   <script>new IntersectionObserver((e,o)=>{e.forEach(i=>{if(i.isIntersecting){i.target.classList.add('visible');o.unobserve(i.target)}})},{threshold:0.15}).observe(document.querySelectorAll('.animate-in'));</script>
   (Replace .observe() with forEach)

5. RESPONSIVE — mobile-first, single breakpoint at 768px. Grid collapses to single column. Hero H1 shrinks to 40px. CTA buttons stack vertically.

6. COPY TONE — write as if you know this company personally. Reference their specific industry, their actual pain points (${weaknesses || "manual processes, slow operations"}), and their target customers (${targetCustomer ?? "their clients"}). Zero generic business-speak.

7. ALL ICONS — inline SVG only (24-40px). No external icon libraries. Draw relevant icons (chart, lightning, shield, rocket, etc.) directly in the HTML.

8. NO external images. Background textures via CSS gradients and SVG patterns only.

Return ONLY the complete HTML document starting with <!DOCTYPE html>. No markdown fences. No explanation.`;
}

export const leadsRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.object({
      status: z.enum(STATUS_VALUES).optional(),
      teamId: z.string().uuid().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const conditions = [];
      if (input?.status) conditions.push(eq(leads.status, input.status));
      if (input?.teamId) conditions.push(eq(leads.teamId, input.teamId));

      return ctx.db
        .select()
        .from(leads)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(leads.createdAt));
    }),

  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.query.leads.findFirst({
        where: eq(leads.id, input.id),
        with: {
          outreach: { orderBy: [desc(leadOutreach.createdAt)] },
          calls: { orderBy: [desc(leadCalls.createdAt)] },
          project: true,
          client: true,
        },
      });
    }),

  create: protectedProcedure
    .input(leadInput)
    .mutation(async ({ ctx, input }) => {
      const [lead] = await ctx.db
        .insert(leads)
        .values({ ...input, email: input.email || null })
        .returning();
      return lead;
    }),

  update: protectedProcedure
    .input(leadInput.partial().extend({
      id: z.string().uuid(),
      status: z.enum(STATUS_VALUES).optional(),
      demoUrl: z.string().optional(),
      aiInsights: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const [lead] = await ctx.db
        .update(leads)
        .set({ ...data, email: data.email || undefined, updatedAt: new Date() })
        .where(eq(leads.id, id))
        .returning();
      return lead;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.delete(leads).where(eq(leads.id, input.id));
    }),

  bulkDelete: protectedProcedure
    .input(z.object({ ids: z.array(z.string().uuid()).min(1).max(500) }))
    .mutation(async ({ ctx, input }) => {
      const deleted = await ctx.db.delete(leads).where(inArray(leads.id, input.ids)).returning({ id: leads.id });
      return { count: deleted.length };
    }),

  bulkScrape: protectedProcedure
    .input(z.object({ ids: z.array(z.string().uuid()).min(1).max(20) }))
    .mutation(async ({ ctx, input }) => {
      const candidates = await ctx.db
        .select({ id: leads.id, website: leads.website })
        .from(leads)
        .where(inArray(leads.id, input.ids));

      const results: { id: string; ok: boolean; error?: string }[] = [];
      for (const lead of candidates) {
        if (!lead.website) { results.push({ id: lead.id, ok: false, error: "no website" }); continue; }
        try {
          const profile = await scrapeWebsite(lead.website);
          await ctx.db
            .update(leads)
            .set({ scrapedProfile: profile, scrapedAt: new Date(), updatedAt: new Date() })
            .where(eq(leads.id, lead.id));
          results.push({ id: lead.id, ok: true });
        } catch (err) {
          results.push({ id: lead.id, ok: false, error: err instanceof Error ? err.message : "unknown" });
        }
      }
      return { results, succeeded: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok).length };
    }),

  bulkGenerateDemo: protectedProcedure
    .input(z.object({ ids: z.array(z.string().uuid()).min(1).max(10) }))
    .mutation(async ({ ctx, input }) => {
      // Sequential — each demo call is a Sonnet generation (~20-40s) and ~$0.05.
      // 10-lead cap keeps a single batch under 7 mins worst-case.
      const results: { id: string; ok: boolean; demoUrl?: string; error?: string }[] = [];

      for (const id of input.ids) {
        try {
          const lead = await ctx.db.query.leads.findFirst({ where: eq(leads.id, id) });
          if (!lead) { results.push({ id, ok: false, error: "not found" }); continue; }

          const name = [lead.firstName, lead.lastName].filter(Boolean).join(" ") || lead.company || "Lead";
          const companyName = lead.company ?? name;

          // Ensure scraped + profile (run inline rather than calling the other mutations,
          // to share the lead row read)
          let scraped: ScrapedProfile | null = lead.scrapedProfile;
          if (!scraped && lead.website) {
            scraped = await scrapeWebsite(lead.website);
            await ctx.db.update(leads).set({ scrapedProfile: scraped, scrapedAt: new Date() }).where(eq(leads.id, id));
          }

          let profile: BusinessProfile | null = lead.businessProfile;
          if (!profile?.summary) {
            let industryAngle: string | null = null;
            let matchedProfileId: string | null = null;
            if (lead.industry) {
              const [match] = await ctx.db
                .select({ id: industryProfiles.id, demoAngle: industryProfiles.demoAngle })
                .from(industryProfiles)
                .where(and(eq(industryProfiles.industry, lead.industry), eq(industryProfiles.isActive, true)))
                .limit(1);
              if (match) { industryAngle = match.demoAngle ?? null; matchedProfileId = match.id; }
            }
            profile = await generateBusinessProfile({
              company: lead.company, industry: lead.industry, website: lead.website,
              jobTitle: lead.jobTitle, scraped, scrapedDataText: lead.scrapedData,
              painPoints: lead.painPoints, techStack: lead.techStack, industryAngle,
            });
            await ctx.db
              .update(leads)
              .set({ businessProfile: profile, businessProfileAt: new Date(), industryProfileId: matchedProfileId })
              .where(eq(leads.id, id));
          }

          const brandColors = profile?.brandColors?.length
            ? profile.brandColors
            : scraped?.brandColors?.length ? scraped.brandColors : ["#7c5cbf", "#4f8ef7", "#0a0a0f"];
          const brandFonts = profile?.brandFonts?.length ? profile.brandFonts : scraped?.brandFonts ?? [];
          const demoAngle = profile?.demoAngle ?? `A clean, modern demo for ${companyName}`;
          const recommendedFeatures = profile?.recommendedFeatures?.join(", ") ?? "Hero, Features, Tech stack, CTA";
          const offer = profile?.offer ?? lead.painPoints ?? "their core service";
          const weaknesses = profile?.visibleWeaknesses?.join("; ") ?? "";
          const tone = profile?.toneOfVoice ?? "professional";

          const demoPrompt = buildDemoPrompt({ companyName, name, jobTitle: lead.jobTitle, industry: lead.industry, offer, targetCustomer: profile?.targetCustomer, tone, weaknesses, brandColors, brandFonts, demoAngle, recommendedFeatures });

          const demoResponse = await anthropic.messages.create({
            model: "claude-sonnet-4-6",
            max_tokens: 4500,
            messages: [{ role: "user", content: demoPrompt }],
          });
          const demoHtml = demoResponse.content[0]?.type === "text" ? demoResponse.content[0].text : "";

          // Create client + project (same as single-demo)
          let client = lead.clientId
            ? (await ctx.db.select().from(clients).where(eq(clients.id, lead.clientId)).limit(1))[0] ?? null
            : null;
          if (!client) {
            const [newClient] = await ctx.db.insert(clients).values({
              name, email: lead.email ?? null, phone: lead.phone ?? null,
              company: lead.company ?? null, website: lead.website ?? null,
              industry: lead.industry ?? null, companySize: lead.companySize ?? null,
              region: lead.region ?? null, existingTech: lead.techStack ?? null,
              currentChallenges: lead.painPoints ?? null, teamId: lead.teamId ?? null,
            }).returning();
            client = newClient!;
          }
          const [project] = await ctx.db.insert(projects).values({
            name: `${companyName} — Demo`,
            clientId: client?.id ?? null,
            projectType: "web_app",
            industry: lead.industry ?? null,
            teamId: lead.teamId ?? null,
            status: "brief",
          }).returning();

          const shareToken = lead.shareToken ?? genShareToken();
          const upload = await uploadHtml(`demos/${id}.html`, demoHtml);
          const blobUrl = upload.ok ? upload.url ?? null : null;
          const demoUrl = `/api/demo/${id}?t=${shareToken}`;

          await ctx.db.update(leads).set({
            clientId: client?.id ?? null,
            projectId: project?.id ?? null,
            demoHtml,
            demoUrl,
            demoBlobUrl: blobUrl,
            shareToken,
            shareRevokedAt: null,
            status: "demo_generated",
            demoGeneratedAt: new Date(),
            updatedAt: new Date(),
          }).where(eq(leads.id, id));

          results.push({ id, ok: true, demoUrl });
        } catch (err) {
          results.push({ id, ok: false, error: err instanceof Error ? err.message : "unknown" });
        }
      }

      return {
        results,
        succeeded: results.filter((r) => r.ok).length,
        failed: results.filter((r) => !r.ok).length,
      };
    }),

  bulkUpdateStatus: protectedProcedure
    .input(z.object({
      ids: z.array(z.string().uuid()).min(1).max(500),
      status: z.enum(STATUS_VALUES),
    }))
    .mutation(async ({ ctx, input }) => {
      const updated = await ctx.db
        .update(leads)
        .set({ status: input.status, updatedAt: new Date() })
        .where(inArray(leads.id, input.ids))
        .returning({ id: leads.id });
      return { count: updated.length };
    }),

  importBulk: protectedProcedure
    .input(z.object({
      rows: z.array(leadInput).min(1).max(500),
      teamId: z.string().uuid().optional(),
      skipDuplicates: z.boolean().default(true),
    }))
    .mutation(async ({ ctx, input }) => {
      const incomingKeys = new Set<string>();
      const filteredRows = input.rows.filter((r) => {
        const k = canonicalDedupKey({ email: r.email, company: r.company, lastName: r.lastName, website: r.website });
        if (!k) return true; // can't dedup without identifiers; keep
        if (incomingKeys.has(k)) return false;
        incomingKeys.add(k);
        return true;
      });

      let skipped = 0;
      let toInsert = filteredRows;

      if (input.skipDuplicates) {
        const existingEmails = new Set<string>();
        const existingWebsites = new Set<string>();
        const emails = filteredRows.map((r) => r.email).filter(Boolean) as string[];
        const websites = filteredRows.map((r) => r.website).filter(Boolean) as string[];
        if (emails.length > 0) {
          const found = await ctx.db.select({ email: leads.email }).from(leads).where(inArray(leads.email, emails));
          for (const f of found) if (f.email) existingEmails.add(f.email.toLowerCase());
        }
        if (websites.length > 0) {
          const found = await ctx.db.select({ website: leads.website }).from(leads).where(inArray(leads.website, websites));
          for (const f of found) if (f.website) existingWebsites.add(f.website.toLowerCase().replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, ""));
        }
        const before = toInsert.length;
        toInsert = toInsert.filter((r) => {
          if (r.email && existingEmails.has(r.email.toLowerCase())) return false;
          if (r.website && existingWebsites.has(r.website.toLowerCase().replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, ""))) return false;
          return true;
        });
        skipped = before - toInsert.length;
      }

      if (toInsert.length === 0) {
        return { count: 0, skipped, total: input.rows.length };
      }

      const rows = toInsert.map((r) => ({
        ...r,
        email: r.email || null,
        source: "csv_import" as const,
        teamId: input.teamId ?? null,
      }));
      const inserted = await ctx.db.insert(leads).values(rows).returning();
      return { count: inserted.length, skipped, total: input.rows.length };
    }),

  // ─── Scraping + Business Profile ───────────────────────────────────────────

  scrapeLead: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const lead = await ctx.db.query.leads.findFirst({ where: eq(leads.id, input.id) });
      if (!lead) throw new Error("Lead not found");
      if (!lead.website) throw new Error("Lead has no website to scrape");

      const profile = await scrapeWebsite(lead.website);

      // Merge inferred fields into the lead row when missing
      const updates: Record<string, unknown> = {
        scrapedProfile: profile,
        scrapedAt: new Date(),
        updatedAt: new Date(),
        source: lead.source === "manual" ? "web_scraper" : lead.source,
      };
      if (!lead.techStack && profile.techSignals?.length) updates.techStack = profile.techSignals.join(", ");
      if (!lead.scrapedData && profile.rawMarkdown) updates.scrapedData = profile.rawMarkdown.slice(0, 4000);

      const [updated] = await ctx.db
        .update(leads)
        .set(updates)
        .where(eq(leads.id, input.id))
        .returning();
      return { lead: updated, profile };
    }),

  generateBusinessProfile: protectedProcedure
    .input(z.object({ id: z.string().uuid(), forceScrape: z.boolean().default(false) }))
    .mutation(async ({ ctx, input }) => {
      const lead = await ctx.db.query.leads.findFirst({ where: eq(leads.id, input.id) });
      if (!lead) throw new Error("Lead not found");

      let scraped: ScrapedProfile | null = lead.scrapedProfile;

      // Auto-scrape if we don't have data yet (or if forced)
      if ((!scraped || input.forceScrape) && lead.website) {
        scraped = await scrapeWebsite(lead.website);
        await ctx.db
          .update(leads)
          .set({ scrapedProfile: scraped, scrapedAt: new Date(), updatedAt: new Date() })
          .where(eq(leads.id, input.id));
      }

      // Look up industry angle template
      let industryAngle: string | null = null;
      let matchedProfileId: string | null = null;
      if (lead.industry) {
        const [match] = await ctx.db
          .select({ id: industryProfiles.id, demoAngle: industryProfiles.demoAngle })
          .from(industryProfiles)
          .where(and(eq(industryProfiles.industry, lead.industry), eq(industryProfiles.isActive, true)))
          .limit(1);
        if (match) {
          industryAngle = match.demoAngle ?? null;
          matchedProfileId = match.id;
        }
      }

      const profile = await generateBusinessProfile({
        company: lead.company,
        industry: lead.industry,
        website: lead.website,
        jobTitle: lead.jobTitle,
        scraped,
        scrapedDataText: lead.scrapedData,
        painPoints: lead.painPoints,
        techStack: lead.techStack,
        industryAngle,
      });

      const [updated] = await ctx.db
        .update(leads)
        .set({
          businessProfile: profile,
          businessProfileAt: new Date(),
          industryProfileId: matchedProfileId,
          painPoints: lead.painPoints || (profile.visibleWeaknesses?.join("; ") ?? null),
          updatedAt: new Date(),
        })
        .where(eq(leads.id, input.id))
        .returning();
      return { lead: updated, profile };
    }),

  // ─── Insights, demo, proposal generation ───────────────────────────────────

  generateInsights: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const lead = await ctx.db.query.leads.findFirst({ where: eq(leads.id, input.id) });
      if (!lead) throw new Error("Lead not found");

      const name = [lead.firstName, lead.lastName].filter(Boolean).join(" ") || "this lead";
      const profile = lead.businessProfile;
      const profileSummary = profile ? `

Business profile (already generated):
- Offer: ${profile.offer ?? "?"}
- Target customer: ${profile.targetCustomer ?? "?"}
- Visible weaknesses: ${profile.visibleWeaknesses?.join("; ") ?? "?"}
- Build opportunities: ${profile.buildOpportunities?.map((o) => o.title).join("; ") ?? "?"}` : "";

      const prompt = `You are a sales consultant for NexoFlow, a software development agency.

Analyze this lead and provide actionable insights for the sales team:

Name: ${name}
Company: ${lead.company ?? "Unknown"}
Title: ${lead.jobTitle ?? "Unknown"}
Industry: ${lead.industry ?? "Unknown"}
Website: ${lead.website ?? "None"}
Tech Stack: ${lead.techStack ?? "Unknown"}
Pain Points: ${lead.painPoints ?? "Not captured"}
${profileSummary}

Respond in JSON with this exact structure:
{
  "summary": "2-3 sentence profile of the lead",
  "whatWeBuild": "What NexoFlow should propose to build for them",
  "techRecommendation": "Recommended tech stack for their project",
  "estimatedScope": "Small (1-2 weeks) | Medium (1-2 months) | Large (3-6 months)",
  "talkingPoints": ["3-5 bullet points for the sales call"],
  "redFlags": ["any concerns or risks"],
  "nextAction": "Specific recommended next step"
}`;

      const response = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }],
      });

      const text = response.content[0]?.type === "text" ? response.content[0].text : "";
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      const insights = jsonMatch ? jsonMatch[0] : text;

      const [updated] = await ctx.db
        .update(leads)
        .set({ aiInsights: insights, status: "reviewing", updatedAt: new Date() })
        .where(eq(leads.id, input.id))
        .returning();
      return updated;
    }),

  generateDemo: protectedProcedure
    .input(z.object({ id: z.string().uuid(), autoBuildProfile: z.boolean().default(true) }))
    .mutation(async ({ ctx, input }) => {
      const lead = await ctx.db.query.leads.findFirst({ where: eq(leads.id, input.id) });
      if (!lead) throw new Error("Lead not found");

      const name = [lead.firstName, lead.lastName].filter(Boolean).join(" ") || lead.company || "Lead";
      const companyName = lead.company ?? name;

      // Step 1: Ensure we have a business profile (auto-scrape + generate if missing)
      let profile: BusinessProfile | null = lead.businessProfile;
      if ((!profile || !profile.summary) && input.autoBuildProfile) {
        let scraped: ScrapedProfile | null = lead.scrapedProfile;
        if (!scraped && lead.website) {
          scraped = await scrapeWebsite(lead.website);
          await ctx.db
            .update(leads)
            .set({ scrapedProfile: scraped, scrapedAt: new Date() })
            .where(eq(leads.id, input.id));
        }
        let industryAngle: string | null = null;
        let matchedProfileId: string | null = null;
        if (lead.industry) {
          const [match] = await ctx.db
            .select({ id: industryProfiles.id, demoAngle: industryProfiles.demoAngle })
            .from(industryProfiles)
            .where(and(eq(industryProfiles.industry, lead.industry), eq(industryProfiles.isActive, true)))
            .limit(1);
          if (match) { industryAngle = match.demoAngle ?? null; matchedProfileId = match.id; }
        }
        profile = await generateBusinessProfile({
          company: lead.company, industry: lead.industry, website: lead.website,
          jobTitle: lead.jobTitle, scraped, scrapedDataText: lead.scrapedData,
          painPoints: lead.painPoints, techStack: lead.techStack, industryAngle,
        });
        await ctx.db
          .update(leads)
          .set({ businessProfile: profile, businessProfileAt: new Date(), industryProfileId: matchedProfileId })
          .where(eq(leads.id, input.id));
      }

      // Step 2: Resolve brand colors and demo angle
      const brandColors = profile?.brandColors?.length
        ? profile.brandColors
        : lead.scrapedProfile?.brandColors?.length
          ? lead.scrapedProfile.brandColors
          : ["#7c5cbf", "#4f8ef7", "#0a0a0f"];
      const brandFonts = profile?.brandFonts?.length ? profile.brandFonts : lead.scrapedProfile?.brandFonts ?? [];
      const demoAngle = profile?.demoAngle ?? `A clean, modern demo for ${companyName}`;
      const recommendedFeatures = profile?.recommendedFeatures?.join(", ") ?? "Hero, Features, Tech stack, CTA";
      const offer = profile?.offer ?? lead.painPoints ?? "their core service";
      const weaknesses = profile?.visibleWeaknesses?.join("; ") ?? "";
      const tone = profile?.toneOfVoice ?? "professional";

      const demoPrompt = buildDemoPrompt({ companyName, name, jobTitle: lead.jobTitle, industry: lead.industry, offer, targetCustomer: profile?.targetCustomer, tone, weaknesses, brandColors, brandFonts, demoAngle, recommendedFeatures });

      const demoResponse = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 4500,
        messages: [{ role: "user", content: demoPrompt }],
      });

      const demoHtml = demoResponse.content[0]?.type === "text" ? demoResponse.content[0].text : "";

      // Step 3: Create/reuse client + project
      let client = lead.clientId
        ? (await ctx.db.select().from(clients).where(eq(clients.id, lead.clientId)).limit(1))[0] ?? null
        : null;

      if (!client) {
        const [newClient] = await ctx.db
          .insert(clients)
          .values({
            name,
            email: lead.email ?? null,
            phone: lead.phone ?? null,
            company: lead.company ?? null,
            website: lead.website ?? null,
            industry: lead.industry ?? null,
            companySize: lead.companySize ?? null,
            region: lead.region ?? null,
            existingTech: lead.techStack ?? null,
            currentChallenges: lead.painPoints ?? null,
            teamId: lead.teamId ?? null,
          })
          .returning();
        client = newClient!;
      }

      const [project] = await ctx.db
        .insert(projects)
        .values({
          name: `${companyName} — Demo`,
          clientId: client?.id ?? null,
          projectType: "web_app",
          industry: lead.industry ?? null,
          teamId: lead.teamId ?? null,
          status: "brief",
        })
        .returning();

      // Step 4: Upload to Blob (graceful fallback)
      const shareToken = lead.shareToken ?? genShareToken();
      let blobUrl: string | null = null;
      const upload = await uploadHtml(`demos/${input.id}.html`, demoHtml);
      if (upload.ok && upload.url) blobUrl = upload.url;

      const demoUrl = `/api/demo/${input.id}?t=${shareToken}`;

      const [updated] = await ctx.db
        .update(leads)
        .set({
          clientId: client?.id ?? null,
          projectId: project?.id ?? null,
          demoHtml,
          demoUrl,
          demoBlobUrl: blobUrl,
          shareToken,
          shareRevokedAt: null,
          status: "demo_generated",
          demoGeneratedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(leads.id, input.id))
        .returning();

      return { lead: updated, projectId: project?.id, demoUrl, shareToken };
    }),

  sendOutreach: protectedProcedure
    .input(z.object({
      leadId: z.string().uuid(),
      channel: z.enum(["email", "whatsapp", "sms", "link"]),
      subject: z.string().optional(),
      message: z.string().min(1),
      shareLink: z.string().optional(),
      templateId: z.string().uuid().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [lead] = await ctx.db
        .select()
        .from(leads)
        .where(eq(leads.id, input.leadId))
        .limit(1);
      if (!lead) throw new Error("Lead not found");

      let providerMessageId: string | null = null;
      let providerStatus: string | null = null;
      let providerError: string | null = null;

      const baseUrl = process.env.NEXTAUTH_URL ?? "https://nexoflow.tech";
      const shareToken = lead.shareToken;
      const demoLink = lead.demoUrl
        ? (shareToken && !lead.demoUrl.includes("t=") ? `${baseUrl}${lead.demoUrl}?t=${shareToken}` : `${baseUrl}${lead.demoUrl}`)
        : null;
      const proposalLink = lead.proposalUrl ? `${baseUrl}${lead.proposalUrl}` : null;

      // ─── Email via Resend ──────────────────────────────────────────────────
      if (input.channel === "email") {
        if (!lead.email) {
          providerError = "No email on lead";
          providerStatus = "failed";
        } else if (!process.env.RESEND_API_KEY && !process.env.AUTH_RESEND_KEY) {
          providerError = "Resend not configured";
          providerStatus = "not_configured";
        } else {
          const demoSection = demoLink
            ? `<p style="margin-top:24px"><a href="${demoLink}" style="display:inline-block;padding:12px 24px;background:linear-gradient(135deg,#7c5cbf,#4f8ef7);color:#fff;border-radius:8px;text-decoration:none;font-weight:600;">View Your Demo →</a></p>`
            : "";
          const proposalSection = proposalLink
            ? `<p style="margin-top:12px"><a href="${proposalLink}" style="display:inline-block;padding:12px 24px;background:#1a1a2e;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;border:1px solid #333;">View Proposal →</a></p>`
            : "";
          try {
            const result = await resend.emails.send({
              from: "NexoFlow <hello@nexoflow.tech>",
              to: [lead.email],
              subject: input.subject ?? "Introduction from NexoFlow",
              html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:40px 20px;color:#1a1a2e;background:#fff;">
                <div style="margin-bottom:32px"><img src="${baseUrl}/logo.png" alt="NexoFlow" height="32" style="display:block" /></div>
                <div style="font-size:15px;line-height:1.7;color:#2d2d44">${input.message.replace(/\n/g, "<br>")}</div>
                ${demoSection}${proposalSection}
                <p style="margin-top:48px;font-size:11px;color:#999;border-top:1px solid #eee;padding-top:20px">Sent via <a href="${baseUrl}" style="color:#7c5cbf;text-decoration:none">NexoFlow</a></p>
              </div>`,
            });
            const data = (result as { data?: { id?: string } | null }).data;
            const error = (result as { error?: { message?: string } | null }).error;
            if (data?.id) {
              providerMessageId = data.id;
              providerStatus = "sent";
            } else if (error) {
              providerError = error.message ?? "Resend returned error";
              providerStatus = "failed";
            }
          } catch (err) {
            providerError = err instanceof Error ? err.message : "unknown";
            providerStatus = "failed";
          }
        }
      }

      // ─── SMS / WhatsApp via Twilio ─────────────────────────────────────────
      if (input.channel === "sms" || input.channel === "whatsapp") {
        if (!lead.phone) {
          providerError = "No phone on lead";
          providerStatus = "failed";
        } else {
          const body = demoLink ? `${input.message}\n\n${demoLink}` : input.message;
          const result = input.channel === "sms"
            ? await sendSms({ to: lead.phone, body })
            : await sendWhatsApp({ to: lead.phone, body });
          if (result.ok) {
            providerMessageId = result.messageId;
            providerStatus = result.status;
          } else {
            providerError = result.error;
            providerStatus = result.status;
          }
        }
      }

      // ─── Record outreach row ───────────────────────────────────────────────
      const [outreach] = await ctx.db
        .insert(leadOutreach)
        .values({
          leadId: input.leadId,
          channel: input.channel,
          subject: input.subject ?? null,
          message: input.message,
          shareLink: input.shareLink ?? demoLink,
          providerMessageId,
          providerStatus,
          providerError,
          sentBy: ctx.user?.id ?? null,
        })
        .returning();

      // Only advance to "sent" if we actually sent (or it's a link/copy channel)
      const sentSuccessfully = providerStatus === "sent" || providerStatus === "queued" || input.channel === "link";
      if (sentSuccessfully) {
        await ctx.db
          .update(leads)
          .set({ status: "sent", updatedAt: new Date() })
          .where(eq(leads.id, input.leadId));
      }

      // Increment template use count if a template was selected
      if (input.templateId && sentSuccessfully) {
        await ctx.db
          .update(outreachTemplates)
          .set({
            useCount: sql`${outreachTemplates.useCount} + 1`,
            lastUsedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(outreachTemplates.id, input.templateId));
      }

      return { outreach, providerStatus, providerError, sentSuccessfully };
    }),

  generateMessage: protectedProcedure
    .input(z.object({
      leadId: z.string().uuid(),
      channel: z.enum(["email", "whatsapp", "sms", "link"]),
    }))
    .mutation(async ({ ctx, input }) => {
      const lead = await ctx.db.query.leads.findFirst({ where: eq(leads.id, input.leadId) });
      if (!lead) throw new Error("Lead not found");

      const name = [lead.firstName, lead.lastName].filter(Boolean).join(" ") || "there";
      const profile = lead.businessProfile;
      const baseUrl = process.env.NEXTAUTH_URL ?? "https://nexoflow.tech";
      const demoUrl = lead.demoUrl ? `${baseUrl}${lead.demoUrl}` : "[demo link]";

      const channel = input.channel;
      const profileContext = profile ? `
- Their offer: ${profile.offer ?? ""}
- Their visible weaknesses we'd solve: ${profile.visibleWeaknesses?.join("; ") ?? ""}
- What we'd build: ${profile.buildOpportunities?.[0]?.title ?? "a custom solution"}` : `
- Their pain points: ${lead.painPoints ?? "not specified"}`;

      const prompt = `Write a ${channel === "email" ? "professional email" : "short message"} from NexoFlow (a software dev agency) to ${name} at ${lead.company ?? "their company"}.

Context:${profileContext}
- Demo link: ${demoUrl}

Write a concise, personalized outreach message. ${channel === "email" ? "Include a subject line on the first line as 'Subject: ...'." : "Keep it under 3 sentences."} Be direct, no fluff. Reference their actual business, not generic phrases.`;

      const response = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 512,
        messages: [{ role: "user", content: prompt }],
      });

      const text = response.content[0]?.type === "text" ? response.content[0].text : "";
      let subject = "";
      let message = text;
      if (channel === "email" && text.startsWith("Subject:")) {
        const lines = text.split("\n");
        subject = lines[0]?.replace("Subject:", "").trim() ?? "";
        message = lines.slice(1).join("\n").trim();
      }

      return { subject, message };
    }),

  // ─── Call Log ──────────────────────────────────────────────────────────────

  addCall: protectedProcedure
    .input(z.object({
      leadId: z.string().uuid(),
      scheduledAt: z.string().optional(),
      completedAt: z.string().optional(),
      outcome: z.enum(["no_show", "won", "lost", "follow_up", "not_interested", "rescheduled"]).optional(),
      notes: z.string().optional(),
      bookingRef: z.string().optional(),
      durationMinutes: z.number().int().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { leadId, scheduledAt, completedAt, ...rest } = input;
      const [call] = await ctx.db
        .insert(leadCalls)
        .values({
          leadId,
          scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
          completedAt: completedAt ? new Date(completedAt) : null,
          calledBy: ctx.user?.id ?? null,
          ...rest,
        })
        .returning();

      if (input.outcome === "won") {
        await ctx.db.update(leads).set({ status: "won", updatedAt: new Date() }).where(eq(leads.id, leadId));
      } else if (input.outcome === "lost" || input.outcome === "not_interested") {
        await ctx.db.update(leads).set({ status: "lost", updatedAt: new Date() }).where(eq(leads.id, leadId));
      }

      return call;
    }),

  updateCall: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      outcome: z.enum(["no_show", "won", "lost", "follow_up", "not_interested", "rescheduled"]).optional(),
      notes: z.string().optional(),
      completedAt: z.string().optional(),
      durationMinutes: z.number().int().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, completedAt, ...rest } = input;
      const [updated] = await ctx.db
        .update(leadCalls)
        .set({ ...rest, completedAt: completedAt ? new Date(completedAt) : undefined, updatedAt: new Date() })
        .where(eq(leadCalls.id, id))
        .returning();
      return updated;
    }),

  generateProposal: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const lead = await ctx.db.query.leads.findFirst({ where: eq(leads.id, input.id) });
      if (!lead) throw new Error("Lead not found");

      const name = [lead.firstName, lead.lastName].filter(Boolean).join(" ") || lead.company || "Valued Partner";
      const companyName = lead.company ?? name;

      const profile = lead.businessProfile;
      const whatWeBuild = profile?.buildOpportunities?.[0]?.title ?? "A custom software solution tailored to your business";
      const offer = profile?.offer ?? "their business";
      const weaknesses = profile?.visibleWeaknesses?.join("; ") ?? lead.painPoints ?? "Not specified";
      const features = profile?.recommendedFeatures?.join(", ") ?? "core feature set";
      const estimatedValue = profile?.estimatedValue ?? "$10k–$25k";

      let insightsObj: Record<string, unknown> = {};
      if (lead.aiInsights) { try { insightsObj = JSON.parse(lead.aiInsights); } catch { /* ignore */ } }
      const techRec = (insightsObj.techRecommendation as string) ?? "Modern, scalable web stack";
      const scope = (insightsObj.estimatedScope as string) ?? "Medium (1-2 months)";

      const proposalPrompt = `You are generating a formal project proposal for NexoFlow, a software development agency.

Create a COMPLETE, single-file HTML proposal document for:
Company: ${companyName}
Contact: ${name}${lead.jobTitle ? ` (${lead.jobTitle})` : ""}
Industry: ${lead.industry ?? "Technology"}
Their offer: ${offer}
What we'd build: ${whatWeBuild}
Recommended features: ${features}
Tech stack: ${techRec}
Estimated scope: ${scope}
Estimated value range: ${estimatedValue}
Visible weaknesses we'll solve: ${weaknesses}

Requirements:
- Clean, professional proposal design (white/light background, dark text, purple brand accents #7c5cbf)
- Sections: Executive Summary, Problem Statement (with their specific weaknesses), Our Proposed Solution, Technical Approach, Project Timeline (3 phases), Investment (use 30/40/30 milestone payment structure, calculate from ${estimatedValue}), Next Steps
- 30/40/30 payment: 30% to start, 40% at midpoint, 30% on delivery
- Include NexoFlow company details, prepared for ${companyName}
- Footer: "Prepared by NexoFlow | nexoflow.tech | hello@nexoflow.tech"
- Professional typography, subtle borders, clean layout
- All CSS inline or in <style> tag — no external dependencies
- Print-friendly (could be converted to PDF)

Return ONLY the complete HTML document starting with <!DOCTYPE html>. No markdown, no explanation.`;

      const proposalResponse = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 8192,
        messages: [{ role: "user", content: proposalPrompt }],
      });

      const proposalHtml = proposalResponse.content[0]?.type === "text" ? proposalResponse.content[0].text : "";
      const proposalUrl = `/api/proposal/${input.id}`;

      const existingVersions = await ctx.db
        .select({ version: proposalVersions.version })
        .from(proposalVersions)
        .where(eq(proposalVersions.leadId, input.id))
        .orderBy(desc(proposalVersions.version))
        .limit(1);
      const nextVersion = (existingVersions[0]?.version ?? 0) + 1;
      await ctx.db.insert(proposalVersions).values({ leadId: input.id, version: nextVersion, html: proposalHtml });

      const upload = await uploadHtml(`proposals/${input.id}-v${nextVersion}.html`, proposalHtml);
      const blobUrl = upload.ok ? upload.url ?? null : null;

      const [updated] = await ctx.db
        .update(leads)
        .set({ proposalHtml, proposalUrl, proposalBlobUrl: blobUrl, updatedAt: new Date() })
        .where(eq(leads.id, input.id))
        .returning();

      return { lead: updated, proposalUrl };
    }),

  scoreWithAi: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const lead = await ctx.db.query.leads.findFirst({ where: eq(leads.id, input.id) });
      if (!lead) throw new Error("Lead not found");

      const prompt = `Score this sales lead from 0-100 and give a one-sentence reason.

Lead info:
- Name: ${[lead.firstName, lead.lastName].filter(Boolean).join(" ") || "Unknown"}
- Company: ${lead.company ?? "Unknown"}
- Industry: ${lead.industry ?? "Unknown"}
- Job Title: ${lead.jobTitle ?? "Unknown"}
- Company Size: ${lead.companySize ?? "Unknown"}
- Region: ${lead.region ?? "Unknown"}
- Pain Points: ${lead.painPoints ?? "None listed"}
- Source: ${lead.source}

Scoring criteria:
- 80-100: Decision maker, clear pain point, good company size, high urgency
- 60-79: Good fit but missing some info or not decision maker
- 40-59: Possible fit, needs qualification
- 0-39: Poor fit or very little info

Respond ONLY with valid JSON: { "score": <number 0-100>, "reason": "<one sentence>" }`;

      const resp = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 200,
        messages: [{ role: "user", content: prompt }],
      });
      const text = resp.content[0]?.type === "text" ? resp.content[0].text.trim() : "{}";
      let score = 50, reason = "AI scoring completed.";
      try {
        const parsed = JSON.parse(text) as { score: number; reason: string };
        score = Math.min(100, Math.max(0, parsed.score));
        reason = parsed.reason;
      } catch { /* use defaults */ }

      const [updated] = await ctx.db
        .update(leads)
        .set({ aiScore: score, aiScoreReason: reason, updatedAt: new Date() })
        .where(eq(leads.id, input.id))
        .returning();
      return updated;
    }),

  parseMeetingNotes: protectedProcedure
    .input(z.object({ id: z.string().uuid(), notes: z.string().min(10) }))
    .mutation(async ({ ctx, input }) => {
      const prompt = `Extract structured CRM data from these meeting notes. Return ONLY valid JSON.

Notes: "${input.notes}"

Return: { "painPoints": string, "budget": string, "timeline": string, "nextSteps": string, "outcome": "interested"|"not_interested"|"follow_up"|"won"|"lost"|"unknown", "summary": string }`;

      const resp = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 500,
        messages: [{ role: "user", content: prompt }],
      });
      const text = resp.content[0]?.type === "text" ? resp.content[0].text.trim() : "{}";
      let parsed = { painPoints: "", budget: "", timeline: "", nextSteps: "", outcome: "unknown" as const, summary: "" };
      try {
        parsed = { ...parsed, ...(JSON.parse(text) as typeof parsed) };
      } catch { /* use defaults */ }

      const updatedNotes = `[Meeting Notes]\n${parsed.summary}\n\nPain Points: ${parsed.painPoints}\nBudget: ${parsed.budget}\nTimeline: ${parsed.timeline}\nNext Steps: ${parsed.nextSteps}`;
      const [updated] = await ctx.db
        .update(leads)
        .set({
          notes: updatedNotes,
          painPoints: parsed.painPoints || undefined,
          updatedAt: new Date(),
        })
        .where(eq(leads.id, input.id))
        .returning();
      return { lead: updated, extracted: parsed };
    }),

  enrichLead: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const lead = await ctx.db.query.leads.findFirst({ where: eq(leads.id, input.id) });
      if (!lead) throw new Error("Lead not found");

      const prompt = `You are a B2B research analyst. Based on the info below, infer enriched profile data.

Company: ${lead.company ?? "Unknown"}
Website: ${lead.website ?? "Unknown"}
Industry: ${lead.industry ?? "Unknown"}
Job Title: ${lead.jobTitle ?? "Unknown"}
Region: ${lead.region ?? "Unknown"}

Return ONLY valid JSON: {
  "techStack": "comma-separated likely tech stack",
  "companySize": "estimated headcount range e.g. '10-50'",
  "painPoints": "2-3 likely pain points for this company type",
  "fundingStage": "bootstrap|seed|series-a|series-b|enterprise",
  "buyerPersona": "brief description of their likely role and priorities"
}`;

      const resp = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 400,
        messages: [{ role: "user", content: prompt }],
      });
      const text = resp.content[0]?.type === "text" ? resp.content[0].text.trim() : "{}";
      let enriched = { techStack: "", companySize: "", painPoints: "", fundingStage: "", buyerPersona: "" };
      try {
        enriched = { ...enriched, ...(JSON.parse(text) as typeof enriched) };
      } catch { /* use defaults */ }

      const [updated] = await ctx.db
        .update(leads)
        .set({
          techStack: enriched.techStack || lead.techStack || null,
          companySize: enriched.companySize || lead.companySize || null,
          painPoints: enriched.painPoints || lead.painPoints || null,
          enrichedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(leads.id, input.id))
        .returning();
      return { lead: updated, enriched };
    }),

  // ─── Follow-up sequences ───────────────────────────────────────────────────

  startFollowUpSequence: protectedProcedure
    .input(z.object({ leadId: z.string().uuid(), name: z.string().optional(), totalSteps: z.number().int().min(1).max(10).optional() }))
    .mutation(async ({ ctx, input }) => {
      const nextSendAt = new Date();
      nextSendAt.setDate(nextSendAt.getDate() + 1);
      const [seq] = await ctx.db
        .insert(followUpSequences)
        .values({
          leadId: input.leadId,
          name: input.name ?? "Default Sequence",
          totalSteps: input.totalSteps ?? 5,
          nextSendAt,
        })
        .returning();
      return seq;
    }),

  pauseFollowUp: protectedProcedure
    .input(z.object({ sequenceId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(followUpSequences)
        .set({ status: "paused", updatedAt: new Date() })
        .where(eq(followUpSequences.id, input.sequenceId))
        .returning();
      return updated;
    }),

  resumeFollowUp: protectedProcedure
    .input(z.object({ sequenceId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const nextSendAt = new Date();
      nextSendAt.setHours(nextSendAt.getHours() + 1);
      const [updated] = await ctx.db
        .update(followUpSequences)
        .set({ status: "active", nextSendAt, updatedAt: new Date() })
        .where(eq(followUpSequences.id, input.sequenceId))
        .returning();
      return updated;
    }),

  getFollowUpSequences: protectedProcedure
    .input(z.object({ leadId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db
        .select()
        .from(followUpSequences)
        .where(eq(followUpSequences.leadId, input.leadId))
        .orderBy(desc(followUpSequences.createdAt));
    }),

  getProposalVersions: protectedProcedure
    .input(z.object({ leadId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db
        .select()
        .from(proposalVersions)
        .where(eq(proposalVersions.leadId, input.leadId))
        .orderBy(desc(proposalVersions.version));
    }),

  signProposal: publicProcedure
    .input(z.object({
      versionId: z.string().uuid(),
      signerName: z.string().min(1),
      signerEmail: z.string().email(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [version] = await ctx.db
        .update(proposalVersions)
        .set({ signedAt: new Date(), signerName: input.signerName, signerEmail: input.signerEmail })
        .where(eq(proposalVersions.id, input.versionId))
        .returning();
      if (version) {
        const lead = await ctx.db.query.leads.findFirst({ where: eq(leads.id, version.leadId) });
        if (lead) {
          void slack.proposalSigned(
            [lead.firstName, lead.lastName].filter(Boolean).join(" ") || "Lead",
            lead.company ?? "Unknown",
          );
        }
      }
      return version;
    }),

  // ─── Demo tracking / share token ───────────────────────────────────────────

  getDemoViews: protectedProcedure
    .input(z.object({ leadId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db
        .select()
        .from(leadDemoViews)
        .where(eq(leadDemoViews.leadId, input.leadId))
        .orderBy(desc(leadDemoViews.lastSeenAt));
    }),

  rotateShareToken: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const newToken = genShareToken();
      const [updated] = await ctx.db
        .update(leads)
        .set({
          shareToken: newToken,
          shareRevokedAt: null,
          demoUrl: sql`'/api/demo/' || ${input.id} || '?t=' || ${newToken}`,
          updatedAt: new Date(),
        })
        .where(eq(leads.id, input.id))
        .returning();
      return updated;
    }),

  revokeShare: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(leads)
        .set({ shareRevokedAt: new Date(), updatedAt: new Date() })
        .where(eq(leads.id, input.id))
        .returning();
      return updated;
    }),

  // ─── Outcomes / conversion feedback ────────────────────────────────────────

  recordOutcome: protectedProcedure
    .input(z.object({
      leadId: z.string().uuid(),
      outcome: z.enum(["won", "lost", "ghosted", "not_a_fit", "follow_up"]),
      valueCents: z.number().int().optional(),
      notes: z.string().optional(),
      demoStyleTag: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const lead = await ctx.db.query.leads.findFirst({ where: eq(leads.id, input.leadId) });
      if (!lead) throw new Error("Lead not found");

      const [outcome] = await ctx.db
        .insert(leadOutcomes)
        .values({
          leadId: input.leadId,
          outcome: input.outcome,
          valueCents: input.valueCents,
          notes: input.notes,
          industryProfileId: lead.industryProfileId,
          demoStyleTag: input.demoStyleTag,
          capturedBy: ctx.user?.id ?? null,
        })
        .returning();

      if (input.outcome === "won") {
        await ctx.db
          .update(leads)
          .set({ status: "won", wonValueCents: input.valueCents ?? null, updatedAt: new Date() })
          .where(eq(leads.id, input.leadId));
      } else if (input.outcome === "lost" || input.outcome === "not_a_fit") {
        await ctx.db
          .update(leads)
          .set({ status: "lost", updatedAt: new Date() })
          .where(eq(leads.id, input.leadId));
      }
      return outcome;
    }),

  getOutcomes: protectedProcedure
    .input(z.object({ leadId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db
        .select()
        .from(leadOutcomes)
        .where(eq(leadOutcomes.leadId, input.leadId))
        .orderBy(desc(leadOutcomes.capturedAt));
    }),

  // ─── Public showcase (for /showcase page) ──────────────────────────────────

  publicShowcase: publicProcedure.query(async ({ ctx }) => {
    const wonLeads = await ctx.db
      .select({
        id: leads.id,
        company: leads.company,
        industry: leads.industry,
        demoUrl: leads.demoUrl,
        shareToken: leads.shareToken,
        shareRevokedAt: leads.shareRevokedAt,
        wonValueCents: leads.wonValueCents,
        businessProfile: leads.businessProfile,
      })
      .from(leads)
      .where(and(eq(leads.status, "won"), sql`${leads.demoUrl} IS NOT NULL`))
      .orderBy(desc(leads.updatedAt))
      .limit(30);

    return wonLeads
      .filter((l) => !l.shareRevokedAt)
      .map((l) => ({
        id: l.id,
        company: l.company,
        industry: l.industry,
        demoUrl: l.demoUrl,
        offer: l.businessProfile?.offer ?? null,
      }));
  }),
});
