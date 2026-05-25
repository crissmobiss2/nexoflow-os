/**
 * Business profile generator.
 *
 * Takes scraped data (+ any existing lead fields) and uses Claude Sonnet to
 * produce a deep BusinessProfile that seeds the demo, proposal, and sales
 * playbook for this prospect. Every field here directly improves output quality.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { BusinessProfile, ScrapedProfile } from "@/server/db/schema";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

interface BusinessProfileInput {
  company?: string | null;
  industry?: string | null;
  website?: string | null;
  jobTitle?: string | null;
  scraped?: ScrapedProfile | null;
  scrapedDataText?: string | null;
  painPoints?: string | null;
  techStack?: string | null;
  industryAngle?: string | null;
}

export async function generateBusinessProfile(input: BusinessProfileInput): Promise<BusinessProfile> {
  const scrapedSummary = summarizeScraped(input.scraped, input.scrapedDataText);

  const prompt = `You are NexoFlow's senior research analyst and sales strategist. Produce a deep Business Intelligence Profile: the definitive brief that NexoFlow's sales team and AI engine will use to generate a custom demo, proposal, and sales playbook for this prospect. Every field must be specific, grounded in the data, and immediately usable.

WRITING RULES (non-negotiable):
- Never use em dashes (the character) anywhere in this profile. Use commas, colons, semicolons, or parentheses instead.
- Write in clear, professional English. No filler.
- All pricing and ROI estimates must be realistic for this specific business type and size.

# Prospect data
Company: ${input.company ?? "Unknown"}
Industry: ${input.industry ?? "Unknown"}
Website: ${input.website ?? "Unknown"}
Contact role: ${input.jobTitle ?? "Unknown"}
Known pain points: ${input.painPoints ?? "None captured"}
Known tech stack: ${input.techStack ?? "Unknown"}
${input.industryAngle ? `NexoFlow industry angle for this sector: ${input.industryAngle}` : ""}

# Scraped website data
${scrapedSummary || "No scrape data available — infer confidently from company name, industry, and typical patterns for this business type."}

# Output
Return ONLY valid JSON in this exact shape (no markdown, no explanation):
{
  "summary": "2-3 sentences: what this business does, who they serve, and what stage they're at. Be specific.",

  "offer": "What they sell — use their own language where possible. Be concrete.",

  "targetCustomer": "Who their buyers are — job title, company size, location if relevant. One sentence.",

  "toneOfVoice": "professional | playful | authoritative | warm | technical — pick the one that best matches their site and industry.",

  "positioningStatement": "Their stated or implied differentiator in one sharp line.",

  "brandColors": ["#hex1", "#hex2", "#hex3"],

  "brandFonts": ["Font Name 1", "Font Name 2"],

  "visibleWeaknesses": [
    "Concrete, specific issues visible on their site or in how they operate. Reference actual evidence. Examples: 'No online booking — calls only forces manual scheduling', 'Homepage takes >4s to load on mobile', 'No pricing page — likely losing comparison shoppers', 'Zero customer reviews or social proof anywhere on site', 'Contact form only — no live chat or immediate response mechanism'. Do NOT invent if no evidence."
  ],

  "buildOpportunities": [
    {
      "title": "Short, punchy opportunity name (e.g. 'Online Booking System', 'Client Portal', 'AI Follow-up Engine')",
      "description": "2 sentences: exactly what NexoFlow would build, why it solves a real and specific problem this company has, and what measurable outcome it delivers.",
      "effort": "Small | Medium | Large"
    }
  ],

  "softwareRecommendations": [
    {
      "name": "Exact product name (e.g. HubSpot, Stripe, Calendly)",
      "category": "CRM | Payments | Analytics | Automation | Marketing | Scheduling | Communication | Security | HR | Finance | Booking | Reviews",
      "reason": "1-2 sentences: WHY this tool for THIS company specifically. Reference their industry, their customer type, or their visible gaps. Do not write generic descriptions.",
      "url": "https://exact-product-url.com"
    }
  ],

  "roiEstimate": "A specific, credible narrative of the financial return on investment this company would see from working with NexoFlow. Example: 'An online booking system for this dental practice would eliminate about 15 hrs/week of phone scheduling (worth about $18K/yr at a receptionist wage), reducing no-shows by 30% through automated reminders and adding back roughly $45K in annual revenue. Total project ROI in Year 1: about 3.5x.' Be specific to their industry and size. Do not use em dashes.",

  "urgencySignals": [
    "Specific, credible reasons WHY they should act now rather than later. Examples: 'Competitors in their zip code already have online booking', 'Their site hasn't been updated in 3+ years based on copyright footer', 'Google reviews mention long wait times / hard to reach — a known conversion killer', 'Their industry is seeing rapid digital adoption — laggards lose 20-30% market share in 2 years'. Ground in evidence where possible."
  ],

  "quickWins": [
    {
      "title": "Fast win NexoFlow can deliver (e.g. 'Google Review Automation', 'Mobile-First Redesign', 'Live Chat Integration')",
      "description": "What we do and the immediate visible impact on their business.",
      "timeline": "1 week | 2 weeks | 1 month"
    }
  ],

  "competitorContext": "1-2 sentences on what their direct competitors are doing digitally that this company is not. This is the FOMO angle for the sales call.",

  "industryFit": "hvac | dental | law | restaurant | ecommerce | saas | agency | real_estate | healthcare | fitness | education | finance | other",

  "demoAngle": "One paragraph describing how the demo should feel and what to lead with. What emotion should the prospect feel when they see it? What specific transformation should the hero headline promise? What's the #1 thing the demo must communicate to make them say 'I need this'?",

  "recommendedFeatures": [
    "Specific custom-built features to showcase in the demo — name them concretely (e.g. 'Automated appointment reminder SMS flow', 'Client-facing project dashboard with live status', 'AI-powered quote generator'). Not generic ('contact form', 'about page')."
  ],

  "estimatedValue": "Realistic project investment range for a business of THIS type and size. Small local businesses (restaurant, solo trade, single-location retail): '$3K–$8K'. Growing SMBs with 10-50 staff: '$8K–$20K'. Multi-location or high-revenue operations: '$15K–$35K'. Only go above $35K for enterprises or complex SaaS integrations. The range must feel achievable for this business. Use en dashes between numbers (e.g. '$8K–$15K')."
}

RULES:
- Every field must be specific. Generic answers like "modern website" or "improve user experience" are REJECTED.
- Never use em dashes (the character) in any field. Use commas, colons, or en dashes for ranges.
- softwareRecommendations: 5-7 tools. Industry examples: dental→(Dentrix, SimplePractice, NexHealth, Birdeye, Google Ads); law→(Clio, MyCase, LawPay, Calendly, Birdeye); restaurant→(Toast, OpenTable, 7shifts, Mailchimp, Google Ads); ecommerce→(Shopify, Klaviyo, Gorgias, Recharge, Triple Whale); saas→(Stripe, Intercom, Mixpanel, Segment, LaunchDarkly); hvac→(ServiceTitan, Jobber, Google Local Services Ads, Podium, Mailchimp); fitness→(Mindbody, Acuity, Mailchimp, Instagram Ads, Google Analytics). Always include at least one analytics tool and one customer communication tool.
- quickWins: 3 items, each deliverable in ≤1 month, with visible impact the client can see immediately.
- urgencySignals: 2-4 items. At least one must reference market/competitive pressure, one must reference an observable gap from their site data.
- buildOpportunities: 3-5 items ordered by business impact (highest first). The first one is what the demo and proposal should lead with.
- Be specific. Infer confidently. A good analyst doesn't say "unknown" — they reason from available signals.`;

  // Attempt generation with 1 automatic retry on JSON parse failure.
  // max_tokens=2600 keeps Anthropic latency ~30-40s, under Vercel's ~60s
  // edge idle-connection timeout. The retry handles the rare case where the
  // model produces a malformed JSON on first attempt.
  let parsed: BusinessProfile | null = null;
  let lastErr: Error | null = null;

  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2600,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content[0]?.type === "text" ? response.content[0].text : "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      lastErr = new Error("BusinessProfile: no JSON in model response");
      continue;
    }

    try {
      parsed = JSON.parse(jsonMatch[0]) as BusinessProfile;
      break; // success — exit loop
    } catch (err) {
      lastErr = new Error(`BusinessProfile: JSON parse failed: ${err instanceof Error ? err.message : "unknown"}`);
      // continue to retry
    }
  }

  if (!parsed) {
    throw lastErr ?? new Error("BusinessProfile: generation failed after 2 attempts");
  }

  parsed.generatedAt = new Date().toISOString();
  return parsed;
}

function summarizeScraped(scraped: ScrapedProfile | null | undefined, fallbackText: string | null | undefined): string {
  if (!scraped) {
    return fallbackText ? `Raw text snippet:\n${fallbackText.slice(0, 2000)}` : "";
  }

  const parts: string[] = [];
  if (scraped.homepage?.title) parts.push(`Homepage title: ${scraped.homepage.title}`);
  if (scraped.homepage?.description) parts.push(`Homepage description: ${scraped.homepage.description}`);
  if (scraped.homepage?.h1) parts.push(`Hero H1: ${scraped.homepage.h1}`);
  if (scraped.about) parts.push(`About section: ${scraped.about.slice(0, 600)}`);
  if (scraped.services?.length) parts.push(`Services / offers: ${scraped.services.join(" | ")}`);
  if (scraped.products?.length) parts.push(`Products: ${scraped.products.join(" | ")}`);
  if (scraped.brandColors?.length) parts.push(`Detected brand colors: ${scraped.brandColors.join(", ")}`);
  if (scraped.brandFonts?.length) parts.push(`Detected brand fonts: ${scraped.brandFonts.join(", ")}`);
  if (scraped.techSignals?.length) parts.push(`Tech stack signals: ${scraped.techSignals.join(", ")}`);
  if (scraped.socialLinks && Object.keys(scraped.socialLinks).length) {
    parts.push(`Social presence: ${Object.entries(scraped.socialLinks).map(([k, v]) => `${k}=${v}`).join(", ")}`);
  }
  if (scraped.contactEmails?.length) parts.push(`Contact emails: ${scraped.contactEmails.join(", ")}`);
  if (scraped.pages?.length) parts.push(`Pages crawled: ${scraped.pages.slice(0, 10).map((p) => p.url).join(", ")}`);
  if (scraped.rawMarkdown) {
    // Keep snippet short — structured fields above carry the signal; large rawMarkdown
    // inflates the prompt and causes slow Anthropic responses that hit edge timeouts.
    parts.push(`Raw markdown sample (first 400 chars):\n${scraped.rawMarkdown.slice(0, 400)}`);
  }
  if (scraped.errors?.length) parts.push(`Scrape errors: ${scraped.errors.join(" | ")}`);

  return parts.join("\n");
}
