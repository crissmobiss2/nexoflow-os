/**
 * Lead website scraper.
 *
 * Two-tier strategy:
 *   1. Firecrawl (if FIRECRAWL_API_KEY is set) — JS-rendered, returns clean markdown
 *      + metadata. Best quality, ~$0.001–0.01 per page.
 *   2. Native fetch + regex parsing — works for static sites, no external dep.
 *      Free, but won't see JS-rendered content.
 *
 * Output is a structured ScrapedProfile (see schema.ts) ready to feed into the
 * business profile generator.
 */

import type { ScrapedProfile } from "@/server/db/schema";

const FIRECRAWL_BASE = "https://api.firecrawl.dev/v1";

const PRIORITY_PATHS = ["/", "/about", "/about-us", "/services", "/products", "/pricing", "/team", "/contact"];

// ─── Public API ──────────────────────────────────────────────────────────────

export async function scrapeWebsite(rawUrl: string): Promise<ScrapedProfile> {
  const url = normalizeUrl(rawUrl);
  if (!url) {
    return { errors: ["Invalid URL"], scrapedAt: new Date().toISOString() };
  }

  const firecrawlKey = process.env.FIRECRAWL_API_KEY;
  if (firecrawlKey) {
    try {
      return await scrapeWithFirecrawl(url, firecrawlKey);
    } catch (err) {
      console.error("[scraper] Firecrawl failed, falling back to native:", err instanceof Error ? err.message : err);
    }
  }

  return await scrapeNative(url);
}

// ─── Firecrawl path ──────────────────────────────────────────────────────────

async function scrapeWithFirecrawl(url: string, apiKey: string): Promise<ScrapedProfile> {
  const resp = await fetch(`${FIRECRAWL_BASE}/scrape`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      url,
      formats: ["markdown", "html", "links"],
      onlyMainContent: false,
      waitFor: 1500,
    }),
    signal: AbortSignal.timeout(45_000),
  });

  if (!resp.ok) {
    throw new Error(`Firecrawl ${resp.status}: ${await resp.text().catch(() => "")}`);
  }

  const json = (await resp.json()) as {
    success: boolean;
    data?: {
      markdown?: string;
      html?: string;
      links?: string[];
      metadata?: Record<string, unknown>;
    };
  };

  if (!json.success || !json.data) {
    throw new Error("Firecrawl returned no data");
  }

  const { markdown = "", html = "", links = [], metadata = {} } = json.data;
  const meta = metadata as Record<string, string | undefined>;

  const profile: ScrapedProfile = {
    homepage: {
      title: meta.title ?? meta["og:title"],
      description: meta.description ?? meta["og:description"],
      markdown: markdown.slice(0, 8000),
    },
    socialLinks: extractSocialLinks(links),
    contactEmails: extractEmails(html + " " + markdown),
    contactPhones: extractPhones(html + " " + markdown),
    brandColors: extractColors(html),
    brandFonts: extractFonts(html),
    logoUrl: (meta["og:image"] as string) || extractLogo(html, url),
    faviconUrl: extractFavicon(html, url),
    techSignals: detectTechStack(html),
    rawMarkdown: markdown.slice(0, 12000),
    scrapedFrom: "firecrawl",
    scrapedAt: new Date().toISOString(),
    pages: links.slice(0, 25).map((u) => ({ url: u })),
  };

  // Extract about/services from markdown headings
  profile.about = extractSection(markdown, ["about", "who we are", "our story"]);
  profile.services = extractList(markdown, ["services", "what we do", "what we offer", "products"]);

  return profile;
}

// ─── Native fetch path ───────────────────────────────────────────────────────

async function scrapeNative(url: string): Promise<ScrapedProfile> {
  const profile: ScrapedProfile = {
    socialLinks: {},
    contactEmails: [],
    contactPhones: [],
    brandColors: [],
    techSignals: [],
    pages: [],
    scrapedFrom: "native",
    scrapedAt: new Date().toISOString(),
    errors: [],
  };

  const origin = new URL(url).origin;
  const pagesToTry = PRIORITY_PATHS.map((p) => origin + p);

  // Add the raw URL itself first if it isn't already in the list
  if (!pagesToTry.includes(url)) pagesToTry.unshift(url);

  const combinedHtml: string[] = [];
  const combinedText: string[] = [];
  let homepageHtml = "";

  for (const pageUrl of pagesToTry.slice(0, 6)) {
    try {
      const resp = await fetch(pageUrl, {
        headers: { "User-Agent": "NexoFlowBot/1.0 (+https://nexoflow.tech)" },
        signal: AbortSignal.timeout(8000),
        redirect: "follow",
      });
      if (!resp.ok) continue;
      const html = await resp.text();
      const text = stripHtml(html);
      combinedHtml.push(html);
      combinedText.push(text);
      profile.pages?.push({ url: pageUrl, title: extractTitle(html) });
      if (pageUrl === url || pageUrl === origin + "/") homepageHtml = html;
    } catch (err) {
      profile.errors?.push(`${pageUrl}: ${err instanceof Error ? err.message : "unknown"}`);
    }
  }

  if (combinedHtml.length === 0) {
    profile.errors?.push("All fetches failed");
    return profile;
  }

  const allHtml = combinedHtml.join("\n");
  const allText = combinedText.join("\n");

  profile.homepage = {
    title: extractTitle(homepageHtml || combinedHtml[0]!),
    description: extractMetaContent(homepageHtml || combinedHtml[0]!, "description"),
    h1: extractH1(homepageHtml || combinedHtml[0]!),
    markdown: allText.slice(0, 8000),
  };

  profile.socialLinks = extractSocialLinksFromHtml(allHtml);
  profile.contactEmails = extractEmails(allHtml + " " + allText);
  profile.contactPhones = extractPhones(allText);
  profile.brandColors = extractColors(allHtml);
  profile.brandFonts = extractFonts(allHtml);
  profile.logoUrl = extractLogo(homepageHtml || combinedHtml[0]!, url);
  profile.faviconUrl = extractFavicon(homepageHtml || combinedHtml[0]!, url);
  profile.techSignals = detectTechStack(allHtml);
  profile.rawMarkdown = allText.slice(0, 12000);
  profile.about = extractSection(allText, ["about", "who we are", "our story"]);
  profile.services = extractList(allText, ["services", "what we do", "what we offer", "products"]);

  return profile;
}

// ─── Extraction helpers ──────────────────────────────────────────────────────

function normalizeUrl(raw: string): string | null {
  if (!raw) return null;
  let s = raw.trim();
  if (!/^https?:\/\//i.test(s)) s = "https://" + s;
  try {
    const u = new URL(s);
    return u.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function extractTitle(html: string): string | undefined {
  return html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim();
}

function extractH1(html: string): string | undefined {
  return html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]?.replace(/<[^>]+>/g, "").trim();
}

function extractMetaContent(html: string, name: string): string | undefined {
  const re = new RegExp(`<meta[^>]+(?:name|property)=["']${name}["'][^>]*content=["']([^"']+)["']`, "i");
  const m = html.match(re);
  if (m) return m[1];
  const re2 = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]*(?:name|property)=["']${name}["']`, "i");
  return html.match(re2)?.[1];
}

function extractEmails(text: string): string[] {
  const matches = text.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi) ?? [];
  const filtered = matches
    .map((e) => e.toLowerCase())
    .filter((e) => !e.includes("@example.") && !e.includes("@sentry") && !e.includes("@wixpress"))
    .filter((e) => !/\.(png|jpg|jpeg|gif|svg|webp|woff|woff2|ttf|css|js)$/i.test(e));
  return [...new Set(filtered)].slice(0, 8);
}

function extractPhones(text: string): string[] {
  const matches = text.match(/(?:\+?\d{1,3}[\s.-]?)?\(?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,4}/g) ?? [];
  return [...new Set(matches.filter((p) => p.replace(/\D/g, "").length >= 9 && p.replace(/\D/g, "").length <= 15))].slice(0, 5);
}

function extractColors(html: string): string[] {
  const hex = html.match(/#[0-9a-f]{6}\b/gi) ?? [];
  const counts = new Map<string, number>();
  for (const c of hex) {
    const k = c.toLowerCase();
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c);
  // Filter out near-white / near-black noise
  return sorted.filter((c) => {
    const r = parseInt(c.slice(1, 3), 16);
    const g = parseInt(c.slice(3, 5), 16);
    const b = parseInt(c.slice(5, 7), 16);
    const sum = r + g + b;
    return sum > 40 && sum < 720;
  }).slice(0, 6);
}

function extractFonts(html: string): string[] {
  const fonts = new Set<string>();
  // Google Fonts hrefs
  const gfMatches = html.match(/fonts\.googleapis\.com\/css[^"']*family=([^"'&]+)/g) ?? [];
  for (const m of gfMatches) {
    const fam = m.match(/family=([^"'&]+)/)?.[1];
    if (fam) fonts.add(decodeURIComponent(fam.replace(/\+/g, " ").split(":")[0]!));
  }
  // font-family declarations
  const ff = html.match(/font-family\s*:\s*[^;}]+/gi) ?? [];
  for (const decl of ff) {
    const first = decl.replace(/font-family\s*:/i, "").split(",")[0]?.replace(/['"]/g, "").trim();
    if (first && first.length < 40 && !/(serif|sans-serif|monospace|system-ui|inherit|initial)/i.test(first)) {
      fonts.add(first);
    }
  }
  return [...fonts].slice(0, 5);
}

function extractLogo(html: string, baseUrl: string): string | undefined {
  const ogImg = extractMetaContent(html, "og:image");
  if (ogImg) return resolveUrl(ogImg, baseUrl);
  const logoImg = html.match(/<img[^>]+(?:alt=["']logo["']|class=["'][^"']*logo[^"']*["'])[^>]*src=["']([^"']+)["']/i)?.[1]
    ?? html.match(/<img[^>]+src=["']([^"']+)["'][^>]+(?:alt=["']logo["']|class=["'][^"']*logo[^"']*["'])/i)?.[1];
  return logoImg ? resolveUrl(logoImg, baseUrl) : undefined;
}

function extractFavicon(html: string, baseUrl: string): string | undefined {
  const fav = html.match(/<link[^>]+rel=["'](?:icon|shortcut icon)["'][^>]*href=["']([^"']+)["']/i)?.[1]
    ?? html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["'](?:icon|shortcut icon)["']/i)?.[1];
  return fav ? resolveUrl(fav, baseUrl) : `${new URL(baseUrl).origin}/favicon.ico`;
}

function resolveUrl(src: string, base: string): string {
  try {
    return new URL(src, base).toString();
  } catch {
    return src;
  }
}

function extractSocialLinksFromHtml(html: string): Record<string, string> {
  const out: Record<string, string> = {};
  const platforms: Record<string, RegExp> = {
    linkedin: /https?:\/\/(?:www\.)?linkedin\.com\/(?:in|company)\/[^"'\s<>]+/i,
    twitter: /https?:\/\/(?:www\.)?(?:twitter|x)\.com\/[a-z0-9_]+/i,
    facebook: /https?:\/\/(?:www\.)?facebook\.com\/[^"'\s<>]+/i,
    instagram: /https?:\/\/(?:www\.)?instagram\.com\/[^"'\s<>?]+/i,
    youtube: /https?:\/\/(?:www\.)?youtube\.com\/(?:c|channel|user|@)[^"'\s<>]+/i,
    tiktok: /https?:\/\/(?:www\.)?tiktok\.com\/@[^"'\s<>]+/i,
    github: /https?:\/\/(?:www\.)?github\.com\/[a-z0-9-]+/i,
  };
  for (const [name, re] of Object.entries(platforms)) {
    const m = html.match(re);
    if (m) out[name] = m[0];
  }
  return out;
}

function extractSocialLinks(links: string[]): Record<string, string> {
  return extractSocialLinksFromHtml(links.join(" "));
}

function detectTechStack(html: string): string[] {
  const signals: string[] = [];
  const tests: { name: string; re: RegExp }[] = [
    { name: "Next.js", re: /_next\/static|__NEXT_DATA__/i },
    { name: "React", re: /react(-dom)?\.production|data-reactroot/i },
    { name: "Vue", re: /\bvue\.(min\.)?js|data-v-[0-9a-f]{8}/i },
    { name: "Angular", re: /ng-version=|angular\.io/i },
    { name: "Svelte", re: /svelte-[0-9a-z]{6,}/i },
    { name: "WordPress", re: /wp-content|wp-includes/i },
    { name: "Shopify", re: /cdn\.shopify\.com|shopify\.theme/i },
    { name: "Wix", re: /wix\.com|static\.wixstatic/i },
    { name: "Squarespace", re: /squarespace\.com|static1\.squarespace/i },
    { name: "Webflow", re: /webflow\.com|webflow\.js/i },
    { name: "HubSpot", re: /hs-scripts|hubspot/i },
    { name: "Tailwind", re: /tailwindcss|tw-/i },
    { name: "Bootstrap", re: /bootstrap\.(min\.)?css|bootstrap\.(min\.)?js/i },
    { name: "jQuery", re: /jquery(-\d|\.min)?\.js/i },
    { name: "Google Analytics", re: /google-analytics\.com|gtag\(|UA-\d|G-[A-Z0-9]{8,}/ },
    { name: "Facebook Pixel", re: /fbevents\.js|connect\.facebook\.net/ },
    { name: "Stripe", re: /js\.stripe\.com/i },
    { name: "Calendly", re: /calendly\.com/i },
    { name: "Intercom", re: /intercom\.io|intercomcdn/i },
    { name: "Cloudflare", re: /cdnjs\.cloudflare|cloudflare\.com\/ajax/i },
    { name: "Vercel", re: /vercel-deployment-url|_vercel/i },
  ];
  for (const t of tests) if (t.re.test(html)) signals.push(t.name);
  return signals;
}

function extractSection(text: string, keywords: string[]): string | undefined {
  const lower = text.toLowerCase();
  for (const kw of keywords) {
    const idx = lower.indexOf(kw.toLowerCase());
    if (idx >= 0) {
      // Take 400 chars starting from after the keyword
      const start = idx + kw.length;
      return text.slice(start, start + 500).trim();
    }
  }
  return undefined;
}

function extractList(text: string, keywords: string[]): string[] | undefined {
  const lower = text.toLowerCase();
  for (const kw of keywords) {
    const idx = lower.indexOf(kw.toLowerCase());
    if (idx >= 0) {
      const slice = text.slice(idx + kw.length, idx + kw.length + 1200);
      // Naive: split on common separators and pull 3-8 word phrases
      const parts = slice.split(/[\n•·*•·]|(?:\.\s+[A-Z])/).map((s) => s.trim()).filter(Boolean);
      const items = parts
        .filter((p) => p.length > 3 && p.length < 80 && /[a-z]/i.test(p))
        .slice(0, 8);
      if (items.length > 0) return items;
    }
  }
  return undefined;
}
