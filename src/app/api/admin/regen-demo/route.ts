import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { leads, clients, projects } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import Anthropic from "@anthropic-ai/sdk";
import { randomBytes } from "crypto";
import { uploadHtml } from "@/lib/blob";
import type { BusinessProfile, ScrapedProfile } from "@/server/db/schema";

export const maxDuration = 300;

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
  // Derive warm dark bg from primary hue for brand coherence
  const bg = "#0d0b09";
  const surface = "rgba(255,255,255,0.04)";
  const displayFont = brandFonts[0]?.trim() ?? (
    industry?.toLowerCase().match(/food|restaurant|hospitality|retail|luxury/) ? "Playfair Display" :
    industry?.toLowerCase().match(/tech|software|saas|ai|finance/) ? "Plus Jakarta Sans" :
    "Satoshi"
  );
  const bodyFont = brandFonts[1]?.trim() ?? "Inter";
  // Use Google Fonts; Satoshi falls back to Inter if not available
  const fontImport = displayFont === "Satoshi"
    ? `https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&display=swap`
    : `https://fonts.googleapis.com/css2?family=${displayFont.replace(/ /g,"+")}:wght@400;600;700;900&family=${bodyFont.replace(/ /g,"+")}:wght@300;400;500;600&display=swap`;

  const painList = weaknesses
    ? weaknesses.split(/[;,]/).filter(Boolean).slice(0, 6).map(w => `• ${w.trim()}`).join("\n")
    : "• manual workflows consuming staff hours\n• no unified customer data\n• slow operations losing revenue";

  const featureList = recommendedFeatures.split(",").filter(Boolean).slice(0, 4).map(f => f.trim());

  return `Output ONLY valid HTML starting with <!DOCTYPE html> — no markdown, no explanation, no code fences. First token must be <!DOCTYPE.

You are an elite UI/UX engineer and conversion designer. Build a world-class, pixel-perfect single-page sales demo for a real prospect.

PROSPECT
Company: ${companyName} | Industry: ${industry ?? "Technology"} | Contact: ${name}${jobTitle ? ` (${jobTitle})` : ""}
What NexoFlow delivers: ${offer}
Their specific pain points:
${painList}
Target customers: ${targetCustomer ?? "their clients"}
Tone: ${tone} | Angle: ${demoAngle}

BRAND PALETTE
Primary: ${primary} | Secondary: ${secondary} | Dark bg: ${bg}
Display font: ${displayFont} | Body font: ${bodyFont}

HTML SKELETON — write in this exact order:
1. <!DOCTYPE html><html><head> — charset, viewport, title, font import, <style> block
2. <body> — 7 sections in order below
3. <script> — IntersectionObserver + analytics beacon (keep under 40 lines)
4. </body></html>

STYLE BLOCK (write this compact — use shorthand, combine selectors):
:root{--p:${primary};--s:${secondary};--bg:${bg};--surface:${surface};--text:#fff;--muted:rgba(255,255,255,0.55);--border:rgba(255,255,255,0.08);--r:16px;--ff-display:'${displayFont}',serif;--ff-body:'${bodyFont}',sans-serif}
*{margin:0;padding:0;box-sizing:border-box}
body{background:var(--bg);color:var(--text);font-family:var(--ff-body);overflow-x:hidden}
@keyframes fadeInUp{from{opacity:0;transform:translateY(48px)}to{opacity:1;transform:translateY(0)}}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
.reveal{opacity:0;transform:translateY(32px);transition:opacity .6s ease,transform .6s ease}.reveal.visible{opacity:1;transform:none}
/* grain texture overlay */
body::after{content:'';position:fixed;inset:0;background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.03'/%3E%3C/svg%3E");pointer-events:none;z-index:9999}
/* nav */
nav{position:fixed;top:0;left:0;right:0;z-index:100;backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);background:rgba(13,11,9,.7);border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;padding:0 5%;height:64px}
.logo{font-family:var(--ff-display);font-weight:700;font-size:1.1rem;letter-spacing:-.02em}
.nav-cta{background:var(--p);color:#fff;border:none;padding:10px 20px;border-radius:8px;font-size:.875rem;font-weight:600;cursor:pointer;text-decoration:none;transition:opacity .2s,transform .15s}
.nav-cta:hover{opacity:.85;transform:scale(1.02)}
/* hero */
.hero{min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:100px 5% 80px;background:radial-gradient(ellipse 80% 60% at 50% 0%,${primary}22 0%,transparent 70%)}
.pill{display:inline-block;background:${primary}22;border:1px solid ${primary}44;color:${primary};padding:6px 16px;border-radius:999px;font-size:.8125rem;font-weight:600;letter-spacing:.04em;text-transform:uppercase;margin-bottom:28px;animation:fadeIn .5s ease forwards}
.hero h1{font-family:var(--ff-display);font-size:clamp(2.5rem,6vw,4rem);font-weight:900;line-height:1.1;letter-spacing:-.03em;max-width:820px;animation:fadeInUp .7s .1s ease both}
.hero-sub{font-size:clamp(1rem,2vw,1.25rem);color:var(--muted);max-width:560px;line-height:1.65;margin-top:20px;animation:fadeInUp .7s .2s ease both}
.cta-group{display:flex;gap:12px;flex-wrap:wrap;justify-content:center;margin-top:36px;animation:fadeInUp .7s .3s ease both}
.btn-primary{background:var(--p);color:#fff;padding:14px 32px;border-radius:10px;font-size:1rem;font-weight:600;text-decoration:none;transition:opacity .2s,transform .15s}
.btn-primary:hover{opacity:.85;transform:scale(1.02)}
.btn-ghost{border:1.5px solid var(--border);color:var(--text);padding:14px 32px;border-radius:10px;font-size:1rem;font-weight:500;text-decoration:none;transition:border-color .2s,background .2s}
.btn-ghost:hover{border-color:rgba(255,255,255,.3);background:rgba(255,255,255,.05)}
.trust-bar{display:flex;gap:32px;flex-wrap:wrap;justify-content:center;margin-top:48px;animation:fadeInUp .7s .4s ease both}
.trust-stat{font-size:.875rem;color:var(--muted)}
.trust-stat strong{color:var(--text);font-weight:600}
/* section wrapper */
.section{padding:96px 5%}
.section-label{font-size:.8125rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--p);margin-bottom:12px}
.section-title{font-family:var(--ff-display);font-size:clamp(1.75rem,4vw,2.75rem);font-weight:700;line-height:1.2;letter-spacing:-.02em;margin-bottom:16px}
.section-sub{color:var(--muted);font-size:1.0625rem;line-height:1.65;max-width:560px;margin-bottom:48px}
/* cards */
.grid-3{display:grid;grid-template-columns:repeat(3,1fr);gap:24px}
.card{background:var(--surface);border:1px solid var(--border);border-radius:var(--r);padding:28px;backdrop-filter:blur(12px);transition:background .2s,border-color .2s,transform .2s}
.card:hover{background:rgba(255,255,255,.07);border-color:rgba(255,255,255,.14);transform:translateY(-3px)}
.card-icon{width:40px;height:40px;margin-bottom:16px;color:var(--p)}
.card h3{font-size:1.0625rem;font-weight:600;margin-bottom:8px;line-height:1.3}
.card p{color:var(--muted);font-size:.9375rem;line-height:1.6}
/* stats bar */
.stats-bar{background:linear-gradient(135deg,${primary}18 0%,${secondary}18 100%);border-top:1px solid var(--border);border-bottom:1px solid var(--border);padding:64px 5%;display:flex;justify-content:center;gap:64px;flex-wrap:wrap;text-align:center}
.stat-item .stat-num{font-family:var(--ff-display);font-size:clamp(2.5rem,5vw,3.5rem);font-weight:900;background:linear-gradient(135deg,${primary},${secondary});-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;line-height:1}
.stat-item .stat-label{color:var(--muted);font-size:.9375rem;margin-top:8px}
/* steps */
.steps{display:grid;grid-template-columns:repeat(3,1fr);gap:32px;counter-reset:steps}
.step{counter-increment:steps;padding:28px;position:relative}
.step::before{content:counter(steps);font-family:var(--ff-display);font-size:3rem;font-weight:900;color:${primary}33;line-height:1;display:block;margin-bottom:16px}
.step h3{font-size:1.0625rem;font-weight:600;margin-bottom:8px}
.step p{color:var(--muted);font-size:.9375rem;line-height:1.6}
/* cta footer */
.cta-footer{text-align:center;padding:96px 5%;background:radial-gradient(ellipse 60% 50% at 50% 100%,${primary}18 0%,transparent 70%)}
.cta-footer h2{font-family:var(--ff-display);font-size:clamp(1.75rem,4vw,2.5rem);font-weight:700;letter-spacing:-.02em;margin-bottom:16px}
.cta-footer p{color:var(--muted);margin-bottom:36px;font-size:1.0625rem}
.copyright{margin-top:48px;color:var(--muted);font-size:.8125rem}
/* responsive */
@media(max-width:768px){.grid-3,.steps{grid-template-columns:1fr}.stats-bar{gap:32px}.trust-bar{gap:16px}.cta-group{flex-direction:column;align-items:center}}

7 BODY SECTIONS — write every one, no placeholders:

SECTION 1 — NAV:
<nav><a class="logo" href="#">${companyName} × NexoFlow</a><a class="nav-cta" href="https://nexoflow.tech">Book a Call</a></nav>

SECTION 2 — HERO (100vh, industry-specific headline that speaks to their exact pain):
- Pill badge: "Custom demo for ${companyName}"
- H1: powerful 8-12 word headline addressing their #1 pain point
- Subtitle: one-sentence transformation promise
- Two CTAs: "See What We'd Build →" (primary) + "View Case Studies" (ghost)
- Trust bar: 3 stats relevant to ${industry ?? "their industry"}

SECTION 3 — PROBLEMS ("The Challenge" section, bg slightly lighter than hero):
- Section label + "The Real Costs of Staying Manual" title
- 3 cards from this pain list: ${painList.replace(/•\s*/g, "").split("\n").filter(Boolean).slice(0,3).join(" | ")}
- Each card: inline SVG icon (32×32, stroke only, 2px stroke-width) + bold stat + 2-sentence description

SECTION 4 — SOLUTION ("What We Build" section):
- Section label + "Your Complete ${industry ?? "Business"} Operating System" title
- ${featureList.length} feature cards: ${featureList.join(" | ")}
- Each card: relevant inline SVG icon + feature name + specific outcome sentence

SECTION 5 — STATS BAR (full-width):
- 3 industry-specific ROI numbers (use realistic, compelling metrics for ${industry ?? "their sector"})
- Format: large number + unit (e.g., "3×", "40%", "6wk") + label below

SECTION 6 — HOW IT WORKS ("3 Steps to Launch"):
- Step 1: Discovery & Brief (1 week)
- Step 2: Design & Build (4 weeks)
- Step 3: Launch & Iterate (ongoing)
- Each step: counter number + title + 2-sentence description

SECTION 7 — CTA FOOTER:
- H2: "Ready to build this for ${companyName}?"
- Subtext: one compelling sentence about speed/results
- Button: "Book a call with NexoFlow →" (href https://nexoflow.tech)
- Copyright: © 2026 NexoFlow. Built for ${companyName}.

JAVASCRIPT (after </main>, before </body>):
- IntersectionObserver: add class "visible" to ".reveal" elements when 20% in view, stagger cards by index × 80ms
- Keep under 35 lines total

Output the complete HTML now, starting with <!DOCTYPE html>.`;
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
