import { eq, desc, and } from "drizzle-orm";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { Resend } from "resend";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "../trpc";
import { leads, leadOutreach, leadCalls, projects, clients, proposalVersions, followUpSequences } from "../db/schema";
import { slack } from "@/lib/slack";

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

export const leadsRouter = createTRPCRouter({
  list: publicProcedure
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

  get: publicProcedure
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

  create: publicProcedure
    .input(leadInput)
    .mutation(async ({ ctx, input }) => {
      const [lead] = await ctx.db
        .insert(leads)
        .values({ ...input, email: input.email || null })
        .returning();
      return lead;
    }),

  update: publicProcedure
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

  delete: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.delete(leads).where(eq(leads.id, input.id));
    }),

  importBulk: publicProcedure
    .input(z.object({
      rows: z.array(leadInput).min(1).max(500),
      teamId: z.string().uuid().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const rows = input.rows.map((r) => ({
        ...r,
        email: r.email || null,
        source: "csv_import" as const,
        teamId: input.teamId ?? null,
      }));
      const inserted = await ctx.db.insert(leads).values(rows).returning();
      return { count: inserted.length };
    }),

  generateInsights: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const lead = await ctx.db.query.leads.findFirst({
        where: eq(leads.id, input.id),
      });
      if (!lead) throw new Error("Lead not found");

      const name = [lead.firstName, lead.lastName].filter(Boolean).join(" ") || "this lead";
      const prompt = `You are a sales consultant for NexoFlow, a software development agency.

Analyze this lead and provide actionable insights for the sales team:

Name: ${name}
Company: ${lead.company ?? "Unknown"}
Title: ${lead.jobTitle ?? "Unknown"}
Industry: ${lead.industry ?? "Unknown"}
Website: ${lead.website ?? "None"}
Tech Stack: ${lead.techStack ?? "Unknown"}
Pain Points: ${lead.painPoints ?? "Not captured"}
Scraped Data: ${lead.scrapedData ?? "None"}

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
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const lead = await ctx.db.query.leads.findFirst({
        where: eq(leads.id, input.id),
      });
      if (!lead) throw new Error("Lead not found");

      const name = [lead.firstName, lead.lastName].filter(Boolean).join(" ") || lead.company || "Lead";
      const companyName = lead.company ?? name;

      // Parse existing AI insights if available
      let insights: Record<string, unknown> = {};
      if (lead.aiInsights) {
        try { insights = JSON.parse(lead.aiInsights); } catch { /* ignore */ }
      }

      // Generate a real demo website using Claude
      const demoPrompt = `You are a world-class web developer creating a personalized demo website for a sales prospect.

Generate a COMPLETE, single-file HTML page that serves as a stunning demo/proposal for:

Company: ${companyName}
Industry: ${lead.industry ?? "Technology"}
Contact: ${name}${lead.jobTitle ? ` (${lead.jobTitle})` : ""}
Website: ${lead.website ?? "N/A"}
Tech Stack: ${lead.techStack ?? "Not specified"}
Pain Points: ${lead.painPoints ?? "Not specified"}
What we'd build: ${(insights.whatWeBuild as string) ?? "A custom software solution"}
Tech recommendation: ${(insights.techRecommendation as string) ?? "Modern web stack"}
Scraped context: ${lead.scrapedData ? lead.scrapedData.slice(0, 500) : "None"}

Requirements:
- Complete single-file HTML (all CSS in <style>, no external dependencies except Google Fonts CDN)
- Professional, modern design with dark theme (#0a0a0f background, purple/blue accents)
- Use CSS variables and smooth animations
- Sections: Hero (company name + tagline), Problem (their pain points), Solution (what we'd build for them), Features (3-4 key capabilities), Tech stack visualization, CTA ("Get Your Custom Build" button)
- Personalized to their specific industry and use case
- Footer with "Built by NexoFlow" branding
- Mobile-responsive
- Compelling, specific copy — not generic

Return ONLY the complete HTML document, starting with <!DOCTYPE html>. No markdown, no explanation.`;

      const demoResponse = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 8192,
        messages: [{ role: "user", content: demoPrompt }],
      });

      const demoHtml = demoResponse.content[0]?.type === "text" ? demoResponse.content[0].text : "";

      // Create or reuse client record
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

      const demoUrl = `/api/demo/${input.id}`;

      const [updated] = await ctx.db
        .update(leads)
        .set({
          clientId: client?.id ?? null,
          projectId: project?.id ?? null,
          demoHtml,
          demoUrl,
          status: "demo_generated",
          demoGeneratedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(leads.id, input.id))
        .returning();

      return { lead: updated, projectId: project?.id, demoUrl };
    }),

  sendOutreach: protectedProcedure
    .input(z.object({
      leadId: z.string().uuid(),
      channel: z.enum(["email", "whatsapp", "sms", "link"]),
      subject: z.string().optional(),
      message: z.string().min(1),
      shareLink: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [outreach] = await ctx.db
        .insert(leadOutreach)
        .values({
          leadId: input.leadId,
          channel: input.channel,
          subject: input.subject ?? null,
          message: input.message,
          shareLink: input.shareLink ?? null,
          sentBy: ctx.user?.id ?? null,
        })
        .returning();

      await ctx.db
        .update(leads)
        .set({ status: "sent", updatedAt: new Date() })
        .where(eq(leads.id, input.leadId));

      // Send real email via Resend when channel is email
      if (input.channel === "email") {
        const [lead] = await ctx.db
          .select({ email: leads.email, demoUrl: leads.demoUrl, proposalUrl: leads.proposalUrl })
          .from(leads)
          .where(eq(leads.id, input.leadId))
          .limit(1);

        if (lead?.email) {
          const baseUrl = process.env.NEXTAUTH_URL ?? "https://nexoflow.tech";
          const demoSection = lead.demoUrl
            ? `<p style="margin-top:24px"><a href="${baseUrl}${lead.demoUrl}" style="display:inline-block;padding:12px 24px;background:linear-gradient(135deg,#7c5cbf,#4f8ef7);color:#fff;border-radius:8px;text-decoration:none;font-weight:600;">View Your Demo →</a></p>`
            : "";
          const proposalSection = lead.proposalUrl
            ? `<p style="margin-top:12px"><a href="${baseUrl}${lead.proposalUrl}" style="display:inline-block;padding:12px 24px;background:#1a1a2e;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;border:1px solid #333;">View Proposal →</a></p>`
            : "";
          try {
            await resend.emails.send({
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
          } catch (err) {
            console.error("[leads.sendOutreach] email send failed:", err instanceof Error ? err.message : err);
          }
        }
      }

      return outreach;
    }),

  generateMessage: protectedProcedure
    .input(z.object({
      leadId: z.string().uuid(),
      channel: z.enum(["email", "whatsapp", "sms", "link"]),
    }))
    .mutation(async ({ ctx, input }) => {
      const lead = await ctx.db.query.leads.findFirst({
        where: eq(leads.id, input.leadId),
      });
      if (!lead) throw new Error("Lead not found");

      const name = [lead.firstName, lead.lastName].filter(Boolean).join(" ") || "there";
      let insights: Record<string, unknown> = {};
      if (lead.aiInsights) {
        try { insights = JSON.parse(lead.aiInsights); } catch { /* ignore */ }
      }

      const channel = input.channel;
      const demoUrl = lead.demoUrl ?? "[demo link]";

      const prompt = `Write a ${channel === "email" ? "professional email" : "short message"} from NexoFlow (a software dev agency) to ${name} at ${lead.company ?? "their company"}.

Context:
- What we'd build: ${(insights.whatWeBuild as string) ?? "a custom solution for their business"}
- Their pain points: ${lead.painPoints ?? "not specified"}
- Demo link: ${demoUrl}

Write a concise, personalized outreach message. ${channel === "email" ? "Include a subject line on the first line as 'Subject: ...'." : "Keep it under 3 sentences."} Be direct, no fluff.`;

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

  addCall: publicProcedure
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

  updateCall: publicProcedure
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
      const lead = await ctx.db.query.leads.findFirst({
        where: eq(leads.id, input.id),
      });
      if (!lead) throw new Error("Lead not found");

      const name = [lead.firstName, lead.lastName].filter(Boolean).join(" ") || lead.company || "Valued Partner";
      const companyName = lead.company ?? name;

      let insights: Record<string, unknown> = {};
      if (lead.aiInsights) {
        try { insights = JSON.parse(lead.aiInsights); } catch { /* ignore */ }
      }

      const whatWeBuild = (insights.whatWeBuild as string) ?? "A custom software solution tailored to your business";
      const techRec = (insights.techRecommendation as string) ?? "Modern, scalable web stack";
      const scope = (insights.estimatedScope as string) ?? "Medium (1-2 months)";

      const proposalPrompt = `You are generating a formal project proposal for NexoFlow, a software development agency.

Create a COMPLETE, single-file HTML proposal document for:
Company: ${companyName}
Contact: ${name}${lead.jobTitle ? ` (${lead.jobTitle})` : ""}
Industry: ${lead.industry ?? "Technology"}
What we'd build: ${whatWeBuild}
Tech stack: ${techRec}
Estimated scope: ${scope}
Pain points: ${lead.painPoints ?? "Not specified"}

Requirements:
- Clean, professional proposal design (white/light background, dark text, purple brand accents #7c5cbf)
- Sections: Executive Summary, Problem Statement, Our Proposed Solution, Technical Approach, Project Timeline (3 phases), Investment (use 30/40/30 milestone payment structure, calculate from a realistic budget range), Next Steps
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

      const [updated] = await ctx.db
        .update(leads)
        .set({ proposalHtml, proposalUrl, updatedAt: new Date() })
        .where(eq(leads.id, input.id))
        .returning();

      return { lead: updated, proposalUrl };
    }),

  scoreWithAi: publicProcedure
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

  parseMeetingNotes: publicProcedure
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

  enrichLead: publicProcedure
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

  startFollowUpSequence: publicProcedure
    .input(z.object({ leadId: z.string().uuid(), name: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const nextSendAt = new Date();
      nextSendAt.setDate(nextSendAt.getDate() + 1);
      const [seq] = await ctx.db
        .insert(followUpSequences)
        .values({ leadId: input.leadId, name: input.name ?? "Default Sequence", nextSendAt })
        .returning();
      return seq;
    }),

  getFollowUpSequences: publicProcedure
    .input(z.object({ leadId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db
        .select()
        .from(followUpSequences)
        .where(eq(followUpSequences.leadId, input.leadId))
        .orderBy(desc(followUpSequences.createdAt));
    }),

  getProposalVersions: publicProcedure
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
});
