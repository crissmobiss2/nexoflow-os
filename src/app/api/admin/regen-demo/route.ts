import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { leads, clients, projects } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import Anthropic from "@anthropic-ai/sdk";
import { randomBytes } from "crypto";
import { uploadHtml } from "@/lib/blob";
import type { BusinessProfile, ScrapedProfile } from "@/server/db/schema";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

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

  return `You are an elite web designer. Build a complete, stunning single-page demo site for a sales prospect. Output ONLY valid HTML — no markdown, no explanation, nothing before <!DOCTYPE html>.

PROSPECT
Company: ${companyName} | Industry: ${industry ?? "Technology"} | Contact: ${name}${jobTitle ? ` (${jobTitle})` : ""}
What NexoFlow builds for them: ${offer}
Their pain points: ${weaknesses || "manual workflows, slow operations"}
Target customers: ${targetCustomer ?? "their clients"}
Tone: ${tone} | Demo angle: ${demoAngle}
Features to highlight: ${recommendedFeatures}

BRAND
Primary: ${primary} | Secondary: ${secondary} | Accent: ${accent}
Font: ${fonts.split(",")[0]?.trim() ?? "Inter"} (import from Google Fonts)

STRUCTURE — write all 7 sections in the <body> with a single compact <style> block:

1. NAV — fixed top bar, logo "Brixton & Co. × NexoFlow", right-side "Book a Call" CTA button
2. HERO — 100vh, dark gradient bg, centered:
   • Pill badge "Custom demo for ${companyName}"
   • H1 headline (powerful, specific to their pain)
   • Subtitle (one sentence on their transformation)
   • Two CTA buttons: primary solid + ghost outline
   • 3 trust stats: "⚡ 6-week delivery  🔒 SOC2-ready  📈 3× faster"
3. PROBLEMS — "The Challenge" — 3 cards (CSS grid), each with inline SVG icon + title + 2-sentence description of their specific pain
4. SOLUTION — "What We Build" — 3-4 feature cards from [${recommendedFeatures}], inline SVG icons, specific copy
5. STATS BAR — full-width gradient strip, 3 big numbers (industry-relevant ROI metrics)
6. HOW IT WORKS — 3 numbered steps, horizontal on desktop
7. CTA FOOTER — "Ready to build this for ${companyName}?" + "Book a call with NexoFlow →" button (href https://nexoflow.tech) + copyright

STYLE RULES
• Use CSS custom properties: --primary:${primary}; --secondary:${secondary}; --bg:#0d0b09; --text:#fff; --muted:#a0a0b0; --radius:16px
• Keep the <style> block concise — use shorthand, combine selectors, avoid repeating values
• fadeInUp keyframe animation on hero, scroll-triggered via IntersectionObserver for cards
• Mobile responsive at 768px — grids collapse to 1 column
• Inline SVG icons only (no external icon libs)
• No external images — CSS gradients and patterns only

Return ONLY the complete HTML starting with <!DOCTYPE html>.`;
}

export async function POST(req: NextRequest) {
  // Secret check
  const secret = req.headers.get("x-admin-secret");
  if (!secret || secret !== process.env.ADMIN_REGEN_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json() as { leadId?: string };
  const leadId = body.leadId;
  if (!leadId) return NextResponse.json({ error: "leadId required" }, { status: 400 });

  const [lead] = await db.select().from(leads).where(eq(leads.id, leadId)).limit(1);
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  const name = [lead.firstName, lead.lastName].filter(Boolean).join(" ") || lead.company || "Lead";
  const companyName = lead.company ?? name;
  const profile = lead.businessProfile as BusinessProfile | null;
  const scraped = lead.scrapedProfile as ScrapedProfile | null;

  const brandColors = profile?.brandColors?.length
    ? profile.brandColors
    : scraped?.brandColors?.length
      ? scraped.brandColors
      : ["#7c5cbf", "#4f8ef7", "#0a0a0f"];
  const brandFonts = profile?.brandFonts?.length ? profile.brandFonts : scraped?.brandFonts ?? [];
  const demoAngle = profile?.demoAngle ?? `A world-class digital solution for ${companyName}`;
  const recommendedFeatures = profile?.recommendedFeatures?.join(", ") ?? "Hero, Features, Tech stack, CTA";
  const offer = profile?.offer ?? lead.painPoints ?? "their core service";
  const weaknesses = profile?.visibleWeaknesses?.join("; ") ?? "";
  const tone = profile?.toneOfVoice ?? "professional";
  const targetCustomer = profile?.targetCustomer ?? undefined;

  const demoPrompt = buildDemoPrompt({
    companyName, name, jobTitle: lead.jobTitle, industry: lead.industry,
    offer, targetCustomer, tone, weaknesses, brandColors, brandFonts, demoAngle, recommendedFeatures,
  });

  const demoResponse = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8000,
    messages: [{ role: "user", content: demoPrompt }],
  });

  const demoHtml = demoResponse.content[0]?.type === "text" ? demoResponse.content[0].text : "";
  if (!demoHtml) return NextResponse.json({ error: "Empty response from Claude" }, { status: 500 });

  // Ensure client exists
  let clientId = lead.clientId;
  if (!clientId) {
    const [newClient] = await db.insert(clients).values({
      name, email: lead.email ?? null, phone: lead.phone ?? null,
      company: lead.company ?? null, website: lead.website ?? null,
      industry: lead.industry ?? null, teamId: lead.teamId ?? null,
    }).returning();
    clientId = newClient?.id ?? null;
  }

  // Ensure project exists
  let projectId = lead.projectId;
  if (!projectId) {
    const [proj] = await db.insert(projects).values({
      name: `${companyName} — Demo`,
      clientId: clientId ?? null,
      projectType: "web_app",
      industry: lead.industry ?? null,
      teamId: lead.teamId ?? null,
      status: "brief",
    }).returning();
    projectId = proj?.id ?? null;
  }

  const shareToken = lead.shareToken ?? randomBytes(24).toString("base64url");
  let blobUrl: string | null = lead.demoBlobUrl ?? null;
  const upload = await uploadHtml(`demos/${leadId}.html`, demoHtml);
  if (upload.ok && upload.url) blobUrl = upload.url;

  const demoUrl = `/api/demo/${leadId}?t=${shareToken}`;

  await db.update(leads).set({
    clientId,
    projectId,
    demoHtml,
    demoUrl,
    demoBlobUrl: blobUrl,
    shareToken,
    shareRevokedAt: null,
    status: "demo_generated",
    demoGeneratedAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(leads.id, leadId));

  return NextResponse.json({
    ok: true,
    demoUrl: `https://nexoflow-os.vercel.app${demoUrl}`,
    shareToken,
    htmlLength: demoHtml.length,
  });
}
