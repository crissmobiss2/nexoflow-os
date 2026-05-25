/**
 * Business profile generator.
 *
 * Takes scraped data (+ any existing lead fields) and uses Claude Sonnet to
 * produce a structured BusinessProfile: their offer, target customer, tone of
 * voice, visible weaknesses, and 3–5 concrete things NexoFlow could build.
 *
 * This is what then seeds the demo + proposal prompts so the output matches
 * the prospect's actual business and brand — not generic copy.
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

  const prompt = `You are NexoFlow's lead-research analyst. Synthesize a deep "Business Internal Profile" that NexoFlow's sales + delivery team will use to generate a branded demo and proposal for this prospect.

# Prospect data
Company: ${input.company ?? "Unknown"}
Industry: ${input.industry ?? "Unknown"}
Website: ${input.website ?? "Unknown"}
Contact role: ${input.jobTitle ?? "Unknown"}
Known pain points: ${input.painPoints ?? "None captured"}
Known tech stack: ${input.techStack ?? "Unknown"}
${input.industryAngle ? `NexoFlow industry angle: ${input.industryAngle}` : ""}

# Scraped website data
${scrapedSummary || "No scrape data available — infer reasonably from company/industry."}

# Output
Return ONLY valid JSON in this exact shape:
{
  "summary": "2-3 sentence profile of the business",
  "offer": "what they sell, in their own words if possible",
  "targetCustomer": "who they're trying to reach",
  "toneOfVoice": "professional/playful/authoritative/warm/technical — pick the closest match",
  "positioningStatement": "their differentiator in one line",
  "brandColors": ["#hex1","#hex2","#hex3"],
  "brandFonts": ["Font Name 1","Font Name 2"],
  "visibleWeaknesses": ["concrete issues visible on their site or in their offer — eg 'no online booking', 'page LCP >4s', 'no mobile menu', 'pricing hidden', 'no social proof'"],
  "buildOpportunities": [
    { "title": "Short opportunity name", "description": "What NexoFlow would build and why it solves a real problem they have", "effort": "Small | Medium | Large" }
  ],
  "industryFit": "one of: hvac, dental, law, restaurant, ecommerce, saas, agency, real_estate, healthcare, fitness, education, finance, other",
  "demoAngle": "one paragraph: how the demo should feel and what to lead with",
  "recommendedFeatures": ["specific features to include in the demo"],
  "softwareRecommendations": [
    { "name": "Tool Name", "category": "Category (CRM|Payments|Analytics|Automation|Marketing|Scheduling|Communication|Security|HR|Finance)", "reason": "1-2 sentences: WHY this specific tool for THIS specific company — reference their industry/size/use-case", "url": "https://tool.com" }
  ],
  "estimatedValue": "rough project value range eg '$10k–$25k'"
}

Important:
- Use the brand colors from the scrape data if available. If only 1-2 are present, derive a complementary palette. If none, suggest tasteful colors that match their industry and tone.
- visibleWeaknesses must be concrete and grounded in the scrape data when possible. Don't invent.
- buildOpportunities should be 3-5 items that NexoFlow can realistically deliver and that match the company's stage.
- softwareRecommendations: provide 4-6 best-in-class tools for this specific business. These are NOT custom builds — these are commercial SaaS tools NexoFlow recommends and can integrate. Examples by industry: dental (Dentrix, Kareo, SimplePractice), law (Clio, LawPay, MyCase), restaurant (Toast, OpenTable, 7shifts), ecommerce (Shopify, Klaviyo, Gorgias), saas (Stripe, Intercom, Mixpanel, Segment), hvac (ServiceTitan, Jobber), fitness (Mindbody, Acuity). Always include at least one analytics tool and one communication tool.
- Be specific. Generic answers ("modern responsive website") are useless. Lean into industry signals.`;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.content[0]?.type === "text" ? response.content[0].text : "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("BusinessProfile: no JSON in model response");
  }

  let parsed: BusinessProfile;
  try {
    parsed = JSON.parse(jsonMatch[0]) as BusinessProfile;
  } catch (err) {
    throw new Error(`BusinessProfile: JSON parse failed: ${err instanceof Error ? err.message : "unknown"}`);
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
    parts.push(`Raw markdown sample (first 3000 chars):\n${scraped.rawMarkdown.slice(0, 3000)}`);
  }
  if (scraped.errors?.length) parts.push(`Scrape errors: ${scraped.errors.join(" | ")}`);

  return parts.join("\n");
}
