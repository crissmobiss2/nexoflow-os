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

// Builds the full <head> + <style> block in TypeScript — zero AI tokens needed for CSS.
// Claude only generates <body> content (~1500 tokens vs ~5000 previously).
function buildDemoHead({
  companyName, primary, secondary, displayFont, bodyFont, fontImport,
}: {
  companyName: string; primary: string; secondary: string;
  displayFont: string; bodyFont: string; fontImport: string;
}): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${companyName} × NexoFlow — Custom Demo</title>
<link href="${fontImport}" rel="stylesheet">
<style>
:root{--p:${primary};--s:${secondary};--bg:#0d0b09;--surface:rgba(255,255,255,0.04);--text:#fff;--muted:rgba(255,255,255,0.55);--border:rgba(255,255,255,0.08);--r:16px;--ff-d:'${displayFont}',serif;--ff-b:'${bodyFont}',sans-serif}
*{margin:0;padding:0;box-sizing:border-box}
html{scroll-behavior:smooth}
body{background:var(--bg);color:var(--text);font-family:var(--ff-b);overflow-x:hidden}
@keyframes fadeInUp{from{opacity:0;transform:translateY(48px)}to{opacity:1;transform:translateY(0)}}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
.reveal{opacity:0;transform:translateY(32px);transition:opacity .6s ease,transform .6s ease}.reveal.visible{opacity:1;transform:none}
body::after{content:'';position:fixed;inset:0;background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.03'/%3E%3C/svg%3E");pointer-events:none;z-index:9999}
nav{position:fixed;top:0;left:0;right:0;z-index:100;backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);background:rgba(13,11,9,.75);border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;padding:0 5%;height:64px}
.logo{font-family:var(--ff-d);font-weight:700;font-size:1.1rem;letter-spacing:-.02em;color:var(--text);text-decoration:none}
.nav-cta{background:var(--p);color:#fff;padding:10px 20px;border-radius:8px;font-size:.875rem;font-weight:600;text-decoration:none;transition:opacity .2s,transform .15s}
.nav-cta:hover{opacity:.85;transform:scale(1.02)}
.hero{min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:100px 5% 80px;background:radial-gradient(ellipse 80% 60% at 50% 0%,${primary}22 0%,transparent 70%)}
.pill{display:inline-block;background:${primary}22;border:1px solid ${primary}44;color:${primary};padding:6px 16px;border-radius:999px;font-size:.8125rem;font-weight:600;letter-spacing:.04em;text-transform:uppercase;margin-bottom:28px;animation:fadeIn .5s ease forwards}
.hero h1{font-family:var(--ff-d);font-size:clamp(2.5rem,6vw,4rem);font-weight:900;line-height:1.1;letter-spacing:-.03em;max-width:820px;animation:fadeInUp .7s .1s ease both}
.hero-sub{font-size:clamp(1rem,2vw,1.25rem);color:var(--muted);max-width:560px;line-height:1.65;margin-top:20px;animation:fadeInUp .7s .2s ease both}
.cta-group{display:flex;gap:12px;flex-wrap:wrap;justify-content:center;margin-top:36px;animation:fadeInUp .7s .3s ease both}
.btn-p{background:var(--p);color:#fff;padding:14px 32px;border-radius:10px;font-size:1rem;font-weight:600;text-decoration:none;transition:opacity .2s,transform .15s;display:inline-block}
.btn-p:hover{opacity:.85;transform:scale(1.02)}
.btn-g{border:1.5px solid var(--border);color:var(--text);padding:14px 32px;border-radius:10px;font-size:1rem;font-weight:500;text-decoration:none;transition:border-color .2s,background .2s;display:inline-block}
.btn-g:hover{border-color:rgba(255,255,255,.3);background:rgba(255,255,255,.05)}
.trust{display:flex;gap:32px;flex-wrap:wrap;justify-content:center;margin-top:48px;animation:fadeInUp .7s .4s ease both}
.trust span{font-size:.875rem;color:var(--muted)}.trust strong{color:var(--text);font-weight:600}
.sec{padding:96px 5%}
.sec-label{font-size:.8125rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--p);margin-bottom:12px}
.sec-title{font-family:var(--ff-d);font-size:clamp(1.75rem,4vw,2.75rem);font-weight:700;line-height:1.2;letter-spacing:-.02em;margin-bottom:16px}
.sec-sub{color:var(--muted);font-size:1.0625rem;line-height:1.65;max-width:560px;margin-bottom:48px}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:24px}
.card{background:var(--surface);border:1px solid var(--border);border-radius:var(--r);padding:28px;backdrop-filter:blur(12px);transition:background .2s,border-color .2s,transform .2s}
.card:hover{background:rgba(255,255,255,.07);border-color:rgba(255,255,255,.14);transform:translateY(-3px)}
.card svg{width:36px;height:36px;margin-bottom:16px;color:var(--p)}
.card h3{font-size:1.0625rem;font-weight:600;margin-bottom:8px;line-height:1.3}
.card p,.card .desc{color:var(--muted);font-size:.9375rem;line-height:1.6}
.stat-bar{background:linear-gradient(135deg,${primary}18 0%,${secondary}18 100%);border-top:1px solid var(--border);border-bottom:1px solid var(--border);padding:64px 5%;display:flex;justify-content:center;gap:64px;flex-wrap:wrap;text-align:center}
.stat-n{font-family:var(--ff-d);font-size:clamp(2.5rem,5vw,3.5rem);font-weight:900;background:linear-gradient(135deg,${primary},${secondary});-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;line-height:1}
.stat-l{color:var(--muted);font-size:.9375rem;margin-top:8px}
.steps{display:grid;grid-template-columns:repeat(3,1fr);gap:32px;counter-reset:st}
.step{counter-increment:st;padding:28px}
.step::before{content:counter(st);font-family:var(--ff-d);font-size:3rem;font-weight:900;color:${primary}33;line-height:1;display:block;margin-bottom:16px}
.step h3{font-size:1.0625rem;font-weight:600;margin-bottom:8px}
.step p{color:var(--muted);font-size:.9375rem;line-height:1.6}
.cta-ft{text-align:center;padding:96px 5%;background:radial-gradient(ellipse 60% 50% at 50% 100%,${primary}18 0%,transparent 70%)}
.cta-ft h2{font-family:var(--ff-d);font-size:clamp(1.75rem,4vw,2.5rem);font-weight:700;letter-spacing:-.02em;margin-bottom:16px}
.cta-ft p{color:var(--muted);margin-bottom:36px;font-size:1.0625rem}
.copy{margin-top:48px;color:var(--muted);font-size:.8125rem}
@media(max-width:768px){.grid,.steps{grid-template-columns:1fr}.stat-bar{gap:32px}.trust{gap:16px}.cta-group{flex-direction:column;align-items:center}}
</style>
</head>
`;
}

function buildDemoPrompt({
  companyName, name, jobTitle, industry, offer, targetCustomer, tone,
  weaknesses, brandColors, brandFonts, demoAngle, recommendedFeatures,
}: {
  companyName: string; name: string; jobTitle?: string | null; industry?: string | null;
  offer: string; targetCustomer?: string | null; tone: string; weaknesses: string;
  brandColors: string[]; brandFonts: string[]; demoAngle: string; recommendedFeatures: string;
}): { prompt: string; head: string } {
  const primary = brandColors[0] ?? "#7c5cbf";
  const secondary = brandColors[1] ?? "#4f8ef7";
  const displayFont = brandFonts[0]?.trim() ?? (
    industry?.toLowerCase().match(/food|restaurant|hospitality|retail|luxury/) ? "Playfair Display" :
    industry?.toLowerCase().match(/tech|software|saas|ai|finance/) ? "Plus Jakarta Sans" :
    "Inter"
  );
  const bodyFont = brandFonts[1]?.trim() ?? "Inter";
  const fontImport = `https://fonts.googleapis.com/css2?family=${displayFont.replace(/ /g,"+")}:ital,wght@0,400;0,600;0,700;0,900;1,400&family=${bodyFont.replace(/ /g,"+")}:wght@300;400;500;600&display=swap`;

  const head = buildDemoHead({ companyName, primary, secondary, displayFont, bodyFont, fontImport });

  const painPoints = weaknesses
    ? weaknesses.split(/[;,]/).filter(Boolean).slice(0, 3).map(w => w.trim())
    : ["manual workflows consuming staff hours", "no unified customer data", "slow operations losing revenue"];
  const features = recommendedFeatures.split(",").filter(Boolean).slice(0, 4).map(f => f.trim());

  const prompt = `You are a conversion copywriter and HTML engineer. Write ONLY the <body>...</body> content for a personalized sales demo page. Output raw HTML only — no DOCTYPE, no <head>, no <style> tags, no markdown.

PROSPECT: ${companyName} | ${industry ?? "Technology"} | Contact: ${name}${jobTitle ? ` (${jobTitle})` : ""}
WHAT WE BUILD: ${offer}
PAIN POINTS: ${painPoints.join(" | ")}
TARGET CUSTOMERS: ${targetCustomer ?? "their clients"}
TONE: ${tone} | ANGLE: ${demoAngle}
CSS CLASSES AVAILABLE: .hero .pill .btn-p .btn-g .trust .sec .sec-label .sec-title .sec-sub .grid .card .stat-bar .stat-n .stat-l .steps .step .cta-ft .copy .reveal

Write exactly these 7 sections inside <body>:

1. <nav> — logo "${companyName} × NexoFlow" (class="logo") + "Book a Call" link to https://nexoflow.tech (class="nav-cta")

2. <section class="hero"> — pill badge "Custom demo for ${companyName}", H1 headline (10 words, speaks directly to "${painPoints[0]}"), subtitle sentence, two CTAs (class="btn-p" + class="btn-g"), trust bar (3 stats with <strong>)

3. <section class="sec"> — label "The Challenge", title "The Real Costs of Staying Manual", 3 cards (class="grid") each with inline SVG icon (viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2") + h3 stat + p description. Cards for: ${painPoints.slice(0,3).join(" | ")}

4. <section class="sec"> — label "What We Build", title "Your Complete ${industry ?? "Business"} Platform", ${features.length} cards (class="grid") for: ${features.join(" | ")}. Each: inline SVG + h3 + p outcome

5. <div class="stat-bar"> — 3 divs each with <div class="stat-n">X</div><div class="stat-l">label</div>. Use ROI metrics for ${industry ?? "this sector"}

6. <section class="sec"> — label "The Process", title "Launch in 6 Weeks", div class="steps" with 3 .step divs: Discovery (1wk), Design & Build (4wk), Launch & Iterate (ongoing)

7. <footer class="cta-ft"> — h2 "Ready to build this for ${companyName}?", p sentence, "Book a call with NexoFlow →" link (class="btn-p" href="https://nexoflow.tech"), p class="copy" "© 2026 NexoFlow. Built for ${companyName}."

End with </body></html>`;

  return { prompt, head };
}
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

  const { prompt: demoPrompt, head: demoHead } = buildDemoPrompt({
    companyName, name, jobTitle: lead.jobTitle, industry: lead.industry,
    offer, targetCustomer, tone, weaknesses, brandColors, brandFonts, demoAngle, recommendedFeatures,
  });

  const demoResponse = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 3000,
    messages: [{ role: "user", content: demoPrompt }],
  });

  const bodyHtml = demoResponse.content[0]?.type === "text" ? demoResponse.content[0].text : "";
  if (!bodyHtml) return NextResponse.json({ error: "Empty response from Claude" }, { status: 500 });

  // Combine deterministic head + AI-generated body
  const demoHtml = demoHead + bodyHtml;

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
