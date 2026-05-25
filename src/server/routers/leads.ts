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
import { db as drizzleDb } from "../db";
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
  softwareRecommendations, roiEstimate, urgencySignals, quickWins, competitorContext,
}: {
  companyName: string; name: string; jobTitle?: string | null; industry?: string | null;
  offer: string; targetCustomer?: string | null; tone: string; weaknesses: string;
  brandColors: string[]; brandFonts: string[]; demoAngle: string; recommendedFeatures: string;
  softwareRecommendations: { name: string; category: string; reason: string; url?: string }[];
  roiEstimate?: string | null;
  urgencySignals?: string[] | null;
  quickWins?: { title: string; description: string; timeline: string }[] | null;
  competitorContext?: string | null;
}): string {
  const primary = brandColors[0] ?? "#7c5cbf";
  const secondary = brandColors[1] ?? "#4f8ef7";
  const accent = brandColors[2] ?? "#0a0a0f";
  const font = (brandFonts[0] ?? "Inter").trim();
  const fontUrl = font.replace(/ /g, "+");

  const softwareList = softwareRecommendations.length > 0
    ? softwareRecommendations.map((s, i) =>
        `  TOOL ${i + 1}: ${s.name} | CATEGORY: ${s.category} | WHY: ${s.reason}${s.url ? ` | URL: ${s.url}` : ""}`,
      ).join("\n")
    : "  (generate 5-6 best-in-class tools for their industry)";

  const roiBlock = roiEstimate
    ? `ROI NARRATIVE (use this to write the ROI section): ${roiEstimate}`
    : `ROI NARRATIVE: Calculate a credible ROI for a ${industry ?? "business"} investing in this project.`;

  const urgencyBlock = urgencySignals?.length
    ? `URGENCY SIGNALS (use in CTA and intro copy):\n${urgencySignals.map((s) => `  - ${s}`).join("\n")}`
    : "";

  const quickWinsBlock = quickWins?.length
    ? `QUICK WINS (show in How It Works):\n${quickWins.map((w) => `  - ${w.title} (${w.timeline}): ${w.description}`).join("\n")}`
    : "";

  const competitorBlock = competitorContext
    ? `COMPETITOR CONTEXT (use as urgency subtext): ${competitorContext}`
    : "";

  return `You are a world-class UI engineer and conversion copywriter. Build a STUNNING, complete, single-file HTML demo page for a software sales prospect. This page will be sent directly to ${name} at ${companyName} — it must feel like it was built specifically for them by a $1M/yr agency.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SALES INTELLIGENCE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Company: ${companyName}
Industry: ${industry ?? "Technology"}
Contact: ${name}${jobTitle ? ` (${jobTitle})` : ""}
What NexoFlow will build for them: ${offer}
Their customers: ${targetCustomer ?? "their clients"}
Brand tone: ${tone}
Their current pain points: ${weaknesses || "manual processes, slow operations, missed revenue"}
Demo angle (how to position this): ${demoAngle}
Custom features to showcase: ${recommendedFeatures}
${roiBlock}
${urgencyBlock}
${quickWinsBlock}
${competitorBlock}

RECOMMENDED SOFTWARE TOOLS FOR ${companyName.toUpperCase()}:
${softwareList}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BRAND
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Primary: ${primary}
Secondary: ${secondary}
Accent: ${accent}
Font: ${font}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
HTML STRUCTURE — CRITICAL: BODY FIRST, CSS LAST
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WRITE IN THIS EXACT ORDER to ensure body content is always complete:
  1. <head> — ONLY font <link> tags and a tiny <style> with :root variables + 3 base rules
  2. <body> — all 10 sections using class names (no inline style="" — use classes defined below)
  3. </body>
  4. <style> — ALL section CSS goes HERE, after </body> (browsers handle this fine)
  5. </html>

<head> contains ONLY:
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=${fontUrl}:ital,wght@0,300;0,400;0,600;0,700;0,900&display=swap" rel="stylesheet">
<style>
:root{--primary:${primary};--secondary:${secondary};--accent:${accent};--bg:[#0a0a12 dark OR #f7f7fb light];--surface:[rgba(255,255,255,0.05) dark OR rgba(0,0,0,0.04) light];--border:[rgba(255,255,255,0.08) dark OR rgba(0,0,0,0.08) light];--text:[#fff dark OR #111827 light];--text-muted:[#9ca3af dark OR #6b7280 light];--radius:16px;--radius-sm:10px;--max-w:1140px}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'${font}',system-ui,sans-serif;background:var(--bg);color:var(--text);line-height:1.6}
</style>
(Nothing else in head — all section CSS goes after </body>)

CSS CLASSES TO USE IN <body> (define them all in the post-body <style> block):
  .container, .section, .sticky-nav, .hero, .hero-h1, .cta-row, .stats-row,
  .grid-2, .grid-3, .card, .animate-in, .animate-in.visible, .badge, .label,
  .tool-card, .step, .metric-card, .btn-primary, .btn-ghost, .footer
  + @keyframes pulse-glow, @media (max-width:768px) rules

The <style> block after </body>:
:root additional values + all component CSS (nav, hero, sections 1-10) +
@keyframes pulse-glow { 0%,100%{box-shadow:0 0 0 0 ${primary}40} 50%{box-shadow:0 0 0 12px ${primary}00} } +
.animate-in{opacity:0;transform:translateY(32px);transition:opacity .7s,transform .7s}
.animate-in.visible{opacity:1;transform:none}
@media(max-width:768px){.grid-3,.grid-2{grid-template-columns:1fr!important}.hero-h1{font-size:40px!important}.cta-row,.stats-row{flex-direction:column!important}}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ALL 10 SECTIONS — WRITE EVERY ONE IN FULL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SECTION 1 — STICKY NAV (position:fixed, top:0, width:100%, z-index:100)
  Background: rgba(bg-color, 0.92) with backdrop-filter:blur(20px)
  Border-bottom: 1px solid var(--border)
  Left side: "NexoFlow" logo text (font-weight:800, gradient text --primary→--secondary) + " × " + companyName (font-weight:600, --text-muted)
  Right side: "Book a Call →" button (gradient bg --primary→--secondary, border-radius:8px, padding:10px 20px, font-size:13px, font-weight:600, animation: pulse-glow 2s ease-in-out infinite)
  Body must have padding-top:72px to offset nav.

SECTION 2 — HERO (min-height:100vh, background: linear-gradient(135deg, --primary 0%, --secondary 60%, darken-of-secondary 100%))
  Center all content. Subtle SVG mesh/dot pattern overlay at 5% opacity.
  - Small pill badge (border:1px solid rgba(255,255,255,0.25), background:rgba(255,255,255,0.1), border-radius:100px, padding:6px 16px, font-size:12px, font-weight:600): "✦ Built exclusively for ${companyName}"
  - H1 class="hero-h1" (font-size:72px, font-weight:900, line-height:1.1, color:#fff, margin-top:20px): Write a POWERFUL, SPECIFIC headline that names their industry and the transformation. NOT generic. Example for HVAC: "Stop losing $8K/month to missed service calls" — make it specific to THIS company's pain.
  - Subheadline (font-size:20px, color:rgba(255,255,255,0.75), max-width:580px, margin:20px auto): One sentence on the exact transformation. Reference their specific offer and who they serve.
  - CTA row (class="cta-row", display:flex, gap:12px, justify-content:center, margin-top:36px):
      Primary: "See How It Works →" (background:white, color:--primary, border-radius:12px, height:56px, padding:0 32px, font-size:16px, font-weight:700, transition: transform 0.2s, box-shadow 0.2s; hover: transform:scale(1.04), box-shadow:0 12px 40px rgba(0,0,0,0.25))
      Ghost: "Book Free Discovery Call" (border:2px solid rgba(255,255,255,0.4), color:white, background:transparent, border-radius:12px, height:56px, padding:0 28px, font-size:16px, font-weight:600)
  - Trust bar (display:flex, gap:32px, justify-content:center, margin-top:40px, flex-wrap:wrap): 4 micro-stats relevant to ${industry}. Format: "⚡ Built in 6–8 weeks" · "🔒 NDA day one" · "📈 Avg 3.2× ROI" · "🏆 100% US-based team"
  - Scroll indicator at bottom: small animated chevron-down SVG

SECTION 3 — PROBLEM ("What's holding ${companyName} back")
  Section padding: var(--section-pad). Background: var(--bg).
  Section label (small caps, --primary color, font-size:11px, letter-spacing:0.15em): "THE CHALLENGE"
  H2 (font-size:40px, font-weight:800, margin-top:8px): "Every day without this system costs ${companyName} real money"
  Subtext: Reference their specific industry — how these problems compound over time.
  3-card grid (class="grid-3", display:grid, grid-template-columns:repeat(3,1fr), gap:24px, margin-top:48px):
    Each card (background:var(--surface), border:1px solid var(--border), border-radius:var(--radius), padding:32px, class="animate-in"):
      - Top-left inline SVG icon (48px×48px, stroke: --primary)
      - H3 (font-size:18px, font-weight:700, margin-top:20px): Problem name — be SPECIFIC to their business
      - P (font-size:14px, color:var(--text-muted), line-height:1.7, margin-top:8px): 2 sentences naming the real cost of this problem. Use numbers where possible.

SECTION 4 — SOLUTION ("What NexoFlow builds for ${companyName}")
  Background: slightly offset from --bg (use var(--surface) or a subtle gradient).
  Section label: "THE SOLUTION"
  H2 (font-size:40px, font-weight:800): "Custom software engineered for your exact workflow"
  Subtext: "Every feature below is built from scratch for ${companyName} — not a template, not an off-the-shelf app."
  3–4 card grid (same styling as problem section but with a colored top border: 3px solid --primary):
    Each card: distinct inline SVG icon + feature name from recommendedFeatures + 2-sentence description of what it does and why it matters for THIS company specifically.
    Add a small "Included" badge (background: --primary 15% opacity, color: --primary, border-radius:100px, font-size:11px, padding:3px 10px) on each card.

SECTION 5 — SOFTWARE ECOSYSTEM ("Your complete tech stack, curated by NexoFlow")
  Background: var(--bg). This section is a KEY differentiator — NexoFlow as strategic advisor, not just a vendor.
  Section label: "SOFTWARE ECOSYSTEM"
  H2 (font-size:40px, font-weight:800): "We don't just build — we architect your entire digital operation"
  Subtext: "NexoFlow recommends, integrates, and connects the best-in-class tools for ${companyName}'s industry — so you have one seamless system instead of 6 disconnected tabs."
  Grid (repeat(auto-fill, minmax(200px, 1fr)), gap:20px, margin-top:48px):
    Each tool card (background:var(--surface), border:1px solid var(--border), border-radius:var(--radius-sm), padding:24px, class="animate-in"):
      - Category badge (background: --primary 12% opacity, color: --primary, border-radius:100px, font-size:10px, font-weight:700, letter-spacing:0.1em, padding:4px 10px)
      - Tool name (font-size:18px, font-weight:700, margin-top:12px)
      - Reason text (font-size:13px, color:var(--text-muted), margin-top:8px, line-height:1.6): Use WHY text from RECOMMENDED SOFTWARE TOOLS — must be specific to ${companyName}
      - Footer row: "✓ NexoFlow integrates this" (font-size:11px, color: --primary, font-weight:600, margin-top:16px, display:flex, align-items:center, gap:4px)
  Callout box below grid (background: linear-gradient(135deg, --primary 10% opacity, --secondary 10% opacity), border:1px solid --primary 20% opacity, border-radius:var(--radius), padding:32px, margin-top:32px, display:flex, align-items:center, gap:24px):
    Large quote: "The difference between good software and great software is the ecosystem it lives in. NexoFlow builds the custom core — and wires it to the tools you already use."
    CTA button: "Talk to us about your stack →" linking to https://nexoflow.tech

SECTION 6 — ROI / VALUE ("The numbers behind the decision")
  Background: linear-gradient(135deg, --primary, --secondary). Full-width. Text white.
  H2 (font-size:40px, font-weight:800, color:#fff): "What this investment returns for ${companyName}"
  Subtext (color:rgba(255,255,255,0.8)): Use the ROI NARRATIVE to write a specific, credible 2-sentence value statement. Reference hours saved, revenue recovered, or efficiency gained.
  3 metric cards (display:flex, gap:32px, justify-content:center, flex-wrap:wrap, margin-top:48px, class="stats-row"):
    Each (background:rgba(255,255,255,0.12), backdrop-filter:blur(16px), border:1px solid rgba(255,255,255,0.2), border-radius:var(--radius), padding:40px 32px, text-align:center, min-width:220px):
      - Big number (font-size:56px, font-weight:900, color:#fff): Industry-specific metric (e.g. "↓ 68%", "$42K", "3.4×")
      - Label (font-size:14px, color:rgba(255,255,255,0.75), margin-top:8px): What this number represents
  Below metrics, a pull-quote in large italic text: "The real question isn't what building this costs. It's what NOT building it costs ${companyName} every month."

SECTION 7 — BEFORE / AFTER ("The transformation")
  Background: var(--bg). This section creates contrast and urgency.
  Section label: "BEFORE & AFTER"
  H2 (font-size:40px, font-weight:800): "How ${companyName} operates today — and where you're headed"
  2-column grid (class="grid-2", gap:24px, margin-top:48px):
    LEFT — "Today" (background:rgba(239,68,68,0.06), border:1px solid rgba(239,68,68,0.2), border-radius:var(--radius), padding:32px):
      H3 (color:#ef4444, font-size:16px, font-weight:700): "⚠ Without NexoFlow"
      List of 4–5 pain points specific to ${companyName}'s business. Each item: "✗ [specific problem]" (color:#ef4444 for the ✗, text color var(--text-muted)). Draw directly from weaknesses and pain points.
    RIGHT — "With NexoFlow" (background: --primary 6% opacity, border: 1px solid --primary 20% opacity, border-radius:var(--radius), padding:32px):
      H3 (color:--primary, font-size:16px, font-weight:700): "✓ With NexoFlow"
      List of 4–5 corresponding wins, written as specific transformations. Each: "✓ [specific positive outcome]" (color:--primary for the ✓).

SECTION 8 — HOW IT WORKS ("From kickoff to launch in 8 weeks")
  Background: slightly different shade from main bg (use var(--surface) or similar).
  Section label: "THE PROCESS"
  H2 (font-size:40px, font-weight:800): "From first call to live system — here's how we work"
  Subtext: "No bloated agency processes. NexoFlow moves fast without cutting corners."
  3-step horizontal timeline (display:grid, grid-template-columns:repeat(3,1fr), gap:32px, margin-top:48px, position:relative):
    Add connector line between steps: ::before pseudo-element, height:2px, gradient --primary→--secondary, top:40px, left:calc(50% + 50px), width:calc(100% - 100px) (hide on mobile).
    Each step (text-align:center, class="animate-in"):
      - Step circle (width:80px, height:80px, border-radius:50%, background: linear-gradient(135deg, --primary, --secondary), display:flex, align-items:center, justify-content:center, margin:0 auto, font-size:28px, font-weight:900, color:#fff)
      - Step title (font-size:18px, font-weight:700, margin-top:20px)
      - Duration badge (background: --primary 12% opacity, color: --primary, border-radius:100px, font-size:11px, padding:4px 12px, margin-top:8px, display:inline-block)
      - Description (font-size:14px, color:var(--text-muted), margin-top:12px, line-height:1.7)
    Steps: (1) "Discovery & Blueprint" / 1 week, (2) "Build & Integrate" / 4–8 weeks, (3) "Launch & Scale" / Ongoing
    If QUICK WINS provided: add quick wins as small checkboxes below step 3 content.

SECTION 9 — FINAL CTA (the close)
  Background: very dark (#080812 for dark theme, #1a1a2e for any theme). Full-width.
  Centered content, max-width:640px, margin:0 auto.
  H2 (font-size:48px, font-weight:900, color:#fff, line-height:1.15): "Ready to build this for ${companyName}?" — then a line break + gradient text (--primary→--secondary): "[specific transformation in 6 words or less]"
  Subtext (color:rgba(255,255,255,0.65), font-size:18px, margin-top:16px): Reference the urgency signal (competitor context or market timing) in one sentence.
  CTA button (margin-top:40px, background: linear-gradient(135deg, --primary, --secondary), color:#fff, border:none, border-radius:14px, height:64px, padding:0 48px, font-size:18px, font-weight:700, cursor:pointer, animation: pulse-glow 2s ease-in-out infinite, display:inline-flex, align-items:center, gap:10px): "Book a Free 30-Min Call →" — link to https://nexoflow.tech
  Below CTA: "No commitment. We'll scope your project for free and tell you exactly what it would cost." (font-size:13px, color:rgba(255,255,255,0.4), margin-top:16px)
  3 proof points (display:flex, gap:32px, justify-content:center, margin-top:32px, flex-wrap:wrap):
    "⚡ Response within 24h" · "🔒 NDA on request" · "🇺🇸 US-based team"

SECTION 10 — FOOTER
  Background: var(--bg). Border-top: 1px solid var(--border).
  Two-column layout: left side = "NexoFlow" logo + tagline "We build software that works."; right side = links.
  Bottom bar: "Custom demo built exclusively for ${companyName} · © 2026 NexoFlow · nexoflow.tech · hello@nexoflow.tech"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
JAVASCRIPT (at end of </body>)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
<script>
// Scroll animations
const obs = new IntersectionObserver(
  (entries) => entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); obs.unobserve(e.target); } }),
  { threshold: 0.12 }
);
document.querySelectorAll('.animate-in').forEach(el => obs.observe(el));

// Sticky nav scroll effect
const nav = document.querySelector('.sticky-nav');
window.addEventListener('scroll', () => {
  if (nav) nav.style.borderBottomColor = window.scrollY > 20 ? 'var(--border)' : 'transparent';
});
</script>

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
COPY RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Write every headline as if you personally know ${companyName} and their specific struggles
- Reference their EXACT industry, EXACT pain points, and EXACT customer type throughout
- NO generic phrases: "take your business to the next level", "digital transformation", "cutting-edge solutions"
- Every number must be credible and industry-specific (not "10× better" — use real estimates)
- The Before/After section must list ACTUAL problems from the weaknesses data, not invented ones
- The ROI section must use the ROI NARRATIVE data provided — do not make up unrelated numbers
- All icons: inline SVG only, no external libraries, no <img> tags

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OUTPUT RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Return ONLY the complete HTML from <!DOCTYPE html> to </html>
- No markdown code fences. No explanation. No preamble.
- CRITICAL ORDER: <head> (fonts + :root only) → <body> (all 10 sections) → </body> → <style> (all CSS) → </html>
- Write ALL 10 sections in <body> BEFORE writing any section CSS
- ALL section CSS goes in the <style> block AFTER </body> — NOT in <head>
- Do NOT truncate, summarise, or skip any section
- The HTML must render correctly in a browser with no external dependencies beyond Google Fonts`;
}

// ─── Background generation helpers (called via next/server after()) ──────────
// These run AFTER the tRPC response is sent, avoiding Vercel's ~60s edge
// idle TCP connection timeout that kills long-running Anthropic calls.

export async function runDemoGeneration(leadId: string, autoBuildProfile: boolean): Promise<void> {
  const lead = await drizzleDb.query.leads.findFirst({ where: eq(leads.id, leadId) });
  if (!lead) return;

  const name = [lead.firstName, lead.lastName].filter(Boolean).join(" ") || lead.company || "Lead";
  const companyName = lead.company ?? name;

  let profile: BusinessProfile | null = lead.businessProfile;
  if ((!profile || !profile.summary) && autoBuildProfile) {
    let scraped: ScrapedProfile | null = lead.scrapedProfile;
    if (!scraped && lead.website) {
      scraped = await scrapeWebsite(lead.website);
      await drizzleDb.update(leads).set({ scrapedProfile: scraped, scrapedAt: new Date() }).where(eq(leads.id, leadId));
    }
    let industryAngle: string | null = null;
    let matchedProfileId: string | null = null;
    if (lead.industry) {
      const [match] = await drizzleDb
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
    await drizzleDb.update(leads)
      .set({ businessProfile: profile, businessProfileAt: new Date(), industryProfileId: matchedProfileId })
      .where(eq(leads.id, leadId));
  }

  const brandColors = profile?.brandColors?.length
    ? profile.brandColors
    : lead.scrapedProfile?.brandColors?.length ? lead.scrapedProfile.brandColors : ["#7c5cbf", "#4f8ef7", "#0a0a0f"];
  const brandFonts = profile?.brandFonts?.length ? profile.brandFonts : lead.scrapedProfile?.brandFonts ?? [];
  const demoAngle = profile?.demoAngle ?? `A clean, modern demo for ${companyName}`;
  const recommendedFeatures = profile?.recommendedFeatures?.join(", ") ?? "Hero, Features, Tech stack, CTA";
  const offer = profile?.offer ?? lead.painPoints ?? "their core service";
  const weaknesses = profile?.visibleWeaknesses?.join("; ") ?? "";
  const tone = profile?.toneOfVoice ?? "professional";
  const softwareRecommendations = profile?.softwareRecommendations ?? [];

  const demoPrompt = buildDemoPrompt({
    companyName, name, jobTitle: lead.jobTitle, industry: lead.industry, offer,
    targetCustomer: profile?.targetCustomer, tone, weaknesses, brandColors, brandFonts,
    demoAngle, recommendedFeatures, softwareRecommendations,
    roiEstimate: profile?.roiEstimate ?? null,
    urgencySignals: profile?.urgencySignals ?? null,
    quickWins: profile?.quickWins ?? null,
    competitorContext: profile?.competitorContext ?? null,
  });

  const anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const demoResponse = await anthropicClient.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8192,
    messages: [{ role: "user", content: demoPrompt }],
  });
  const demoHtml = demoResponse.content[0]?.type === "text" ? demoResponse.content[0].text : "";

  let client = lead.clientId
    ? (await drizzleDb.select().from(clients).where(eq(clients.id, lead.clientId)).limit(1))[0] ?? null
    : null;
  if (!client) {
    const [newClient] = await drizzleDb.insert(clients).values({
      name, email: lead.email ?? null, phone: lead.phone ?? null,
      company: lead.company ?? null, website: lead.website ?? null,
      industry: lead.industry ?? null, companySize: lead.companySize ?? null,
      region: lead.region ?? null, existingTech: lead.techStack ?? null,
      currentChallenges: lead.painPoints ?? null, teamId: lead.teamId ?? null,
    }).returning();
    client = newClient!;
  }

  let project = lead.projectId
    ? (await drizzleDb.select().from(projects).where(eq(projects.id, lead.projectId)).limit(1))[0] ?? null
    : null;
  if (!project) {
    const [newProject] = await drizzleDb.insert(projects).values({
      name: `${companyName} — Demo`,
      clientId: client?.id ?? null,
      projectType: "web_app",
      industry: lead.industry ?? null,
      teamId: lead.teamId ?? null,
      status: "brief",
    }).returning();
    project = newProject!;
  }

  const shareToken = lead.shareToken ?? genShareToken();
  const upload = await uploadHtml(`demos/${leadId}.html`, demoHtml);
  const blobUrl = upload.ok ? upload.url ?? null : null;
  const demoUrl = `/api/demo/${leadId}?t=${shareToken}`;

  await drizzleDb.update(leads).set({
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
  }).where(eq(leads.id, leadId));
}

export async function runProposalGeneration(leadId: string): Promise<void> {
  const lead = await drizzleDb.query.leads.findFirst({ where: eq(leads.id, leadId) });
  if (!lead) return;

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

  const softwareRecs = profile?.softwareRecommendations ?? [];
  const softwareRecsText = softwareRecs.length > 0
    ? softwareRecs.map((s) => `- ${s.name} (${s.category}): ${s.reason}`).join("\n")
    : "Best-in-class tools relevant to their industry";

  const proposalPrompt = `You are generating a formal project proposal for NexoFlow, a software development agency.

Create a COMPLETE, single-file HTML proposal document for:
Company: ${companyName}
Contact: ${name}${lead.jobTitle ? ` (${lead.jobTitle})` : ""}
Industry: ${lead.industry ?? "Technology"}
Their offer: ${offer}
What we'd build: ${whatWeBuild}
Recommended custom features: ${features}
Tech stack NexoFlow will use: ${techRec}
Estimated scope: ${scope}
Estimated value range: ${estimatedValue}
Visible weaknesses we'll solve: ${weaknesses}
Recommended software tools for their business:
${softwareRecsText}

Requirements:
- Clean, professional proposal design (white/light background, dark text, purple brand accents #7c5cbf)
- Sections (ALL required):
  1. Executive Summary
  2. Problem Statement (with their specific weaknesses listed)
  3. Our Proposed Solution (custom software NexoFlow builds for them)
  4. Recommended Software Ecosystem — a table or card grid showing each recommended tool (name, category, why it's right for them), with a note that NexoFlow integrates all of them. This section is KEY — it shows we're a strategic advisor, not just a vendor.
  5. Technical Approach (stack NexoFlow will use, architecture overview)
  6. Project Timeline (3 phases with weeks)
  7. Investment (30/40/30 milestone payment structure, calculated from ${estimatedValue})
  8. Next Steps (clear call to action — book discovery call at nexoflow.tech)
- 30/40/30 payment: 30% to start, 40% at midpoint, 30% on delivery
- Include NexoFlow company details, prepared for ${companyName}
- Footer: "Prepared by NexoFlow | nexoflow.tech | hello@nexoflow.tech"
- Professional typography, subtle borders, clean layout
- All CSS inline or in <style> tag — no external dependencies
- Print-friendly (could be converted to PDF)
- Output the COMPLETE HTML — do not truncate or stop early

Return ONLY the complete HTML document starting with <!DOCTYPE html>. No markdown, no explanation.`;

  const anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const proposalResponse = await anthropicClient.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8192,
    messages: [{ role: "user", content: proposalPrompt }],
  });
  const proposalHtml = proposalResponse.content[0]?.type === "text" ? proposalResponse.content[0].text : "";
  const proposalUrl = `/api/proposal/${leadId}`;

  const existingVersions = await drizzleDb
    .select({ version: proposalVersions.version })
    .from(proposalVersions)
    .where(eq(proposalVersions.leadId, leadId))
    .orderBy(desc(proposalVersions.version))
    .limit(1);
  const nextVersion = (existingVersions[0]?.version ?? 0) + 1;
  await drizzleDb.insert(proposalVersions).values({ leadId, version: nextVersion, html: proposalHtml });

  const upload = await uploadHtml(`proposals/${leadId}-v${nextVersion}.html`, proposalHtml);
  const blobUrl = upload.ok ? upload.url ?? null : null;

  await drizzleDb.update(leads)
    .set({ proposalHtml, proposalUrl, proposalBlobUrl: blobUrl, updatedAt: new Date() })
    .where(eq(leads.id, leadId));
}

// ─────────────────────────────────────────────────────────────────────────────

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

          const softwareRecommendations = profile?.softwareRecommendations ?? [];
          const demoPrompt = buildDemoPrompt({
            companyName, name, jobTitle: lead.jobTitle, industry: lead.industry, offer,
            targetCustomer: profile?.targetCustomer, tone, weaknesses, brandColors, brandFonts,
            demoAngle, recommendedFeatures, softwareRecommendations,
            roiEstimate: profile?.roiEstimate ?? null,
            urgencySignals: profile?.urgencySignals ?? null,
            quickWins: profile?.quickWins ?? null,
            competitorContext: profile?.competitorContext ?? null,
          });

          const demoResponse = await anthropic.messages.create({
            model: "claude-sonnet-4-6",
            max_tokens: 8192,
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

      const profileContext = profile ? `
BUSINESS PROFILE (from website analysis):
- Summary: ${profile.summary ?? "?"}
- Their offer: ${profile.offer ?? "?"}
- Their customer: ${profile.targetCustomer ?? "?"}
- Visible weaknesses: ${profile.visibleWeaknesses?.join("; ") ?? "?"}
- Build opportunities: ${profile.buildOpportunities?.map((o) => `${o.title} (${o.effort})`).join("; ") ?? "?"}
- Estimated project value: ${profile.estimatedValue ?? "?"}
- ROI estimate: ${profile.roiEstimate ?? "?"}
- Urgency signals: ${profile.urgencySignals?.join("; ") ?? "?"}
- Competitor context: ${profile.competitorContext ?? "?"}
- Quick wins available: ${profile.quickWins?.map((w) => `${w.title} (${w.timeline})`).join("; ") ?? "?"}` : "";

      const prompt = `You are NexoFlow's senior sales strategist. Generate a complete, actionable sales brief that an account executive can use before their first call with this lead. Be specific, opinionated, and direct — generic advice is useless.

LEAD DATA:
Name: ${name}
Company: ${lead.company ?? "Unknown"}
Title: ${lead.jobTitle ?? "Unknown"}
Industry: ${lead.industry ?? "Unknown"}
Website: ${lead.website ?? "None"}
Tech Stack: ${lead.techStack ?? "Unknown"}
Pain Points: ${lead.painPoints ?? "Not captured"}
AI Score: ${lead.aiScore ?? "Not scored"}
${profileContext}

Return ONLY valid JSON with this exact structure:
{
  "summary": "3 sentences: who they are, what they do, and why NexoFlow is a strong fit right now. Be specific — no generic filler.",

  "whatWeBuild": "Specific 2-3 sentence description of the exact thing NexoFlow proposes to build for them. Reference their industry and their actual gaps. Name the product type (booking system, client portal, AI chatbot, etc.).",

  "techRecommendation": "Exact stack NexoFlow would use for this project and why it's right for their scale and needs. Use real technology names.",

  "estimatedScope": "Small (1–4 weeks) | Medium (5–10 weeks) | Large (3–6 months)",

  "talkingPoints": [
    "5 highly specific talking points for the discovery call. Each must reference a real detail about their business. Format: '[Problem/opportunity observed] → [How NexoFlow addresses it] → [Expected outcome]'. Never use generic statements."
  ],

  "openingHook": "The single most compelling opening line for the first email or call — references something specific to their business that shows you've done your homework. 1-2 sentences.",

  "objectionHandlers": [
    { "objection": "Likely objection they'll raise", "response": "Exactly how to handle it — specific to their business context" }
  ],

  "redFlags": ["Genuine risks or concerns that could kill the deal — be honest. If budget mismatch, unclear decision maker, or low urgency, say so."],

  "pricingAnchor": "Suggested opening price range and how to frame it. Reference the estimated value range and ROI context. Example: 'Open at $18K–$22K, anchored to the $45K/yr savings from eliminating manual scheduling.'",

  "nextAction": "The single most important next step — specific and time-bound. What should happen in the next 48 hours?"
}`;

      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 2048,
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

      // Fire-and-forget to a dedicated background API route.
      // This runs in its own Vercel function invocation (up to 300s maxDuration),
      // completely independent of the tRPC request lifecycle or edge idle timeout.
      // await the fetch so the HTTP connection is established before Vercel freezes
      // the tRPC function post-response. The background route returns 202 instantly
      // (<100ms) via after(), so this await doesn't add meaningful latency.
      const origin = "url" in ctx.req && typeof (ctx.req as Request).url === "string"
        ? new URL((ctx.req as Request).url).origin
        : (process.env.NEXTAUTH_URL ?? "https://nexoflow-os.vercel.app");
      await fetch(`${origin}/api/background/demo/${input.id}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-internal-secret": process.env.CRON_SECRET ?? process.env.ADMIN_REGEN_SECRET ?? "",
        },
        body: JSON.stringify({ autoBuildProfile: input.autoBuildProfile }),
        signal: AbortSignal.timeout(10000),
      }).catch(() => { /* ignore — background route may already be running */ });

      return { status: "started" };
    }),

  // (legacy inline version kept as _generateDemoInline for bulk/internal use)
  _generateDemoInline: protectedProcedure
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

      const softwareRecommendations = profile?.softwareRecommendations ?? [];
      const demoPrompt = buildDemoPrompt({
        companyName, name, jobTitle: lead.jobTitle, industry: lead.industry, offer,
        targetCustomer: profile?.targetCustomer, tone, weaknesses, brandColors, brandFonts,
        demoAngle, recommendedFeatures, softwareRecommendations,
        roiEstimate: profile?.roiEstimate ?? null,
        urgencySignals: profile?.urgencySignals ?? null,
        quickWins: profile?.quickWins ?? null,
        competitorContext: profile?.competitorContext ?? null,
      });

      const demoResponse = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 8192,
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

      // await the fetch so the HTTP connection is established before Vercel freezes
      // the tRPC function post-response. The background route returns 202 instantly.
      const origin = "url" in ctx.req && typeof (ctx.req as Request).url === "string"
        ? new URL((ctx.req as Request).url).origin
        : (process.env.NEXTAUTH_URL ?? "https://nexoflow-os.vercel.app");
      await fetch(`${origin}/api/background/proposal/${input.id}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-internal-secret": process.env.CRON_SECRET ?? process.env.ADMIN_REGEN_SECRET ?? "",
        },
        signal: AbortSignal.timeout(10000),
      }).catch(() => { /* ignore — background route may already be running */ });

      return { status: "started" };
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
