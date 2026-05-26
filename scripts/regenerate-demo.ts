/**
 * Force-regenerate a demo using Sonnet 4.6 + buildDemoPrompt.
 * Run: npx tsx --env-file .env.local scripts/regenerate-demo.ts <leadId>
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import Anthropic from "@anthropic-ai/sdk";
import { eq } from "drizzle-orm";
import { leads } from "../src/server/db/schema";
import type { BusinessProfile, ScrapedProfile } from "../src/server/db/schema";

const LEAD_ID = process.argv[2] ?? "634f66c8-ab26-4545-9395-064c13d88edb";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error("DATABASE_URL is required");
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is required");

const sql = postgres(DATABASE_URL, { max: 1 });
const db = drizzle(sql);
const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

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
     --surface: /* semi-transparent card bg */;
     --text: /* #ffffff for dark bg, #111111 for light bg */;
     --text-muted: /* muted color */;
     --radius: 16px;
   }

2. GOOGLE FONTS — import ${fonts.split(",")[0]?.trim()} at top of <style>: @import url('https://fonts.googleapis.com/css2?family=${(fonts.split(",")[0]?.trim() ?? "Inter").replace(/ /g, "+")}:wght@400;600;700;900&display=swap');

3. SECTIONS (in this exact order):
   a. HERO — full-viewport-height, gradient background using --primary → --secondary (135deg), centered content:
      - Pill badge: "Custom demo for ${companyName}" with border: 1px solid rgba(255,255,255,0.2)
      - H1 (72px desktop / 40px mobile, font-weight:900): A powerful, specific headline referencing their exact problem
      - Subheadline (20px): One sentence on the transformation NexoFlow delivers for them
      - Two CTAs side-by-side: primary button (solid --primary, 56px height, border-radius:12px), ghost button
      - Below CTAs: 3 trust micro-stats inline relevant to their industry

   b. PROBLEM — "The challenge ${companyName} faces today" — 3 cards in a CSS grid:
      - Each card: backdrop-filter:blur(20px), border-radius:var(--radius)
      - Inline SVG icon (40px), bold problem title, 2-sentence description using THEIR specific pain points

   c. SOLUTION — "What NexoFlow builds for ${companyName}" — same card grid:
      - 3-4 feature cards from recommendedFeatures, each with distinct inline SVG icon
      - Feature title + description written specifically for their business context

   d. STATS BAR — full-width gradient strip, 3 large metrics in a flex row:
      - Industry-relevant numbers (e.g. "↓ 70% manual work", "↑ 40% faster ops", "$120K saved/yr")
      - Large number (56px, bold white) + label underneath

   e. HOW IT WORKS — 3-step timeline (horizontal on desktop, vertical on mobile):
      - Step numbers in circles (gradient border), step title + 1-line description

   f. CTA SECTION — full-width dark background:
      - Large headline: "Ready to build this for ${companyName}?"
      - Subtext referencing their specific transformation
      - Single large CTA button: "Book a call with NexoFlow →" linking to https://nexoflow.tech
      - Below: "No commitment. 30-min discovery call."

   g. FOOTER — minimal:
      - "Custom demo built for ${companyName} · NexoFlow © 2026"
      - nexoflow.tech link

4. ANIMATIONS — CSS keyframes only (fadeInUp), IntersectionObserver to animate .animate-in elements.

5. RESPONSIVE — mobile-first, single breakpoint at 768px. Grid collapses to single column.

6. COPY TONE — write as if you know this company personally. Reference their specific industry, actual pain points, and target customers. Zero generic business-speak.

7. ALL ICONS — inline SVG only (24-40px). No external icon libraries.

8. NO external images. Background textures via CSS gradients and SVG patterns only.

Return ONLY the complete HTML document starting with <!DOCTYPE html>. No markdown fences. No explanation.`;
}

async function main() {
  console.log(`\n🔄 Regenerating demo for lead: ${LEAD_ID}\n`);

  const [lead] = await db.select().from(leads).where(eq(leads.id, LEAD_ID)).limit(1);
  if (!lead) throw new Error(`Lead ${LEAD_ID} not found`);

  console.log(`✓ Found lead: ${lead.company ?? lead.firstName} — ${lead.website ?? "no website"}`);

  const name = [lead.firstName, lead.lastName].filter(Boolean).join(" ") || lead.company || "Lead";
  const companyName = lead.company ?? name;
  const profile = lead.businessProfile as BusinessProfile | null;
  const scraped = lead.scrapedProfile as ScrapedProfile | null;

  const brandColors = profile?.brandColors?.length
    ? profile.brandColors
    : scraped?.brandColors?.length
      ? scraped.brandColors
      : ["#c0392b", "#2c3e50", "#1a1a2e"];  // Smokehouse-appropriate dark red palette

  const brandFonts = profile?.brandFonts?.length ? profile.brandFonts : scraped?.brandFonts ?? ["Oswald", "system-ui"];
  const demoAngle = profile?.demoAngle ?? `Online ordering + operations system built specifically for ${companyName}`;
  const recommendedFeatures = profile?.recommendedFeatures?.join(", ") ?? "Online ordering platform, Kitchen display system, Loyalty rewards, Analytics dashboard, Mobile ordering app";
  const offer = profile?.offer ?? lead.painPoints ?? "a complete digital ordering and operations system";
  const weaknesses = profile?.visibleWeaknesses?.join("; ") ?? "manual order taking, no online presence, disconnected POS, no customer loyalty program";
  const tone = profile?.toneOfVoice ?? "bold, authentic, community-focused";
  const targetCustomer = profile?.targetCustomer ?? "BBQ and smokehouse lovers, local families, catering clients";

  console.log(`  Brand: ${brandColors.slice(0,2).join(", ")}`);
  console.log(`  Angle: ${demoAngle}`);
  console.log(`  Features: ${recommendedFeatures}`);
  console.log(`\n📡 Calling Claude Sonnet 4.6 (this takes ~25-35 seconds)...\n`);

  const demoPrompt = buildDemoPrompt({
    companyName, name, jobTitle: lead.jobTitle, industry: lead.industry ?? "Food & Beverage",
    offer, targetCustomer, tone, weaknesses, brandColors, brandFonts, demoAngle, recommendedFeatures,
  });

  const demoResponse = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4500,
    messages: [{ role: "user", content: demoPrompt }],
  });

  const demoHtml = demoResponse.content[0]?.type === "text" ? demoResponse.content[0].text : "";
  if (!demoHtml) throw new Error("Empty response from Claude");

  console.log(`✓ Got HTML response (${demoHtml.length.toLocaleString()} chars)`);

  // Upload to Vercel Blob if token is set
  const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN;
  let blobUrl: string | null = lead.demoBlobUrl ?? null;

  if (BLOB_TOKEN) {
    console.log(`  Uploading to Vercel Blob...`);
    const resp = await fetch(`https://blob.vercel-storage.com/demos%2F${LEAD_ID}.html`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${BLOB_TOKEN}`,
        "x-content-type": "text/html; charset=utf-8",
        "x-add-random-suffix": "1",
      },
      body: demoHtml,
    });
    if (resp.ok) {
      const json = (await resp.json()) as { url: string };
      blobUrl = json.url;
      console.log(`  ✓ Blob URL: ${blobUrl}`);
    } else {
      console.warn(`  ⚠ Blob upload failed (${resp.status}) — using DB-only storage`);
    }
  }

  const shareToken = lead.shareToken ?? (() => {
    const bytes = new Uint8Array(24);
    crypto.getRandomValues(bytes);
    return Buffer.from(bytes).toString("base64url");
  })();

  const demoUrl = `/api/demo/${LEAD_ID}?t=${shareToken}`;

  await db.update(leads).set({
    demoHtml,
    demoUrl,
    demoBlobUrl: blobUrl,
    shareToken,
    shareRevokedAt: null,
    status: "demo_generated",
    demoGeneratedAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(leads.id, LEAD_ID));

  console.log(`\n✅ Demo regenerated successfully!`);
  console.log(`\n🔗 Public URL:`);
  console.log(`   https://nexoflow-os.vercel.app${demoUrl}`);
  console.log(`\n   Token: ${shareToken}`);

  await sql.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
