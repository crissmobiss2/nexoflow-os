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

// ─── Industry stat presets ────────────────────────────────────────────────────
const STATS: Record<string, Array<{ n: string; l: string }>> = {
  restaurant: [
    { n: "+34%", l: "Average increase in pickup revenue after online ordering launch" },
    { n: "68%", l: "Of diners choose restaurants that offer digital ordering over those that don't" },
    { n: "4.2×", l: "ROI on automated SMS loyalty campaigns vs. manual outreach in food & beverage" },
  ],
  saas: [
    { n: "+47%", l: "Increase in trial-to-paid conversion with automated onboarding flows" },
    { n: "83%", l: "Reduction in support volume after self-serve knowledge base launch" },
    { n: "3.8×", l: "Customer LTV improvement with in-app upsell automation" },
  ],
  ecommerce: [
    { n: "+29%", l: "Average revenue uplift from abandoned cart and post-purchase automation" },
    { n: "74%", l: "Of shoppers expect personalised product recommendations on return visits" },
    { n: "5.1×", l: "ROI on loyalty program customers vs. one-time buyers" },
  ],
  healthcare: [
    { n: "–62%", l: "Reduction in missed appointments with automated SMS reminders" },
    { n: "91%", l: "Patient satisfaction improvement after digital intake and follow-up rollout" },
    { n: "3.3×", l: "Staff efficiency gain from automated scheduling and follow-up workflows" },
  ],
  default: [
    { n: "+38%", l: "Average efficiency gain reported after deploying purpose-built automation" },
    { n: "72%", l: "Of customers prefer digital-first service interactions over phone or email" },
    { n: "5.1×", l: "ROI on custom software vs. stitched-together generic tools" },
  ],
};

function getStats(industry: string | null): Array<{ n: string; l: string }> {
  const k = (industry ?? "").toLowerCase();
  if (k.match(/restaurant|food|dining|smokehouse|bbq|hospitality|cafe|bar|beverage/)) return STATS.restaurant!;
  if (k.match(/saas|software|tech|ai|platform|dev/)) return STATS.saas!;
  if (k.match(/ecommerce|e-commerce|retail|shop|store/)) return STATS.ecommerce!;
  if (k.match(/health|medical|dental|clinic|therapy/)) return STATS.healthcare!;
  return STATS.default!;
}

// ─── Deterministic HTML builders ─────────────────────────────────────────────

function buildHead({
  companyName, primary, secondary, displayFont, bodyFont, fontImport,
}: {
  companyName: string; primary: string; secondary: string;
  displayFont: string; bodyFont: string; fontImport: string;
}): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(companyName)} × NexoFlow — Custom Demo</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="${fontImport}" rel="stylesheet">
<style>
:root{
  --p:${primary};--s:${secondary};
  --bg:#0d0b09;--surface:rgba(255,255,255,0.045);
  --text:#f5f0eb;--muted:rgba(245,240,235,0.55);--faint:rgba(245,240,235,0.2);
  --border:rgba(255,255,255,0.09);--border-h:rgba(255,255,255,0.18);
  --r:14px;--r-sm:8px;
  --ff-d:'${displayFont}',Georgia,serif;
  --ff-b:'${bodyFont}','Helvetica Neue',sans-serif;
}
*{margin:0;padding:0;box-sizing:border-box}
html{scroll-behavior:smooth;-webkit-font-smoothing:antialiased}
body{background:var(--bg);color:var(--text);font-family:var(--ff-b);overflow-x:hidden;line-height:1.6}

/* Grain overlay */
body::before{
  content:'';position:fixed;inset:0;z-index:9998;pointer-events:none;
  background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.028'/%3E%3C/svg%3E");
}

/* Animations */
@keyframes fadeUp{from{opacity:0;transform:translateY(40px)}to{opacity:1;transform:none}}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
@keyframes countUp{from{opacity:0;transform:scale(.85)}to{opacity:1;transform:scale(1)}}

/* Scroll reveal */
.reveal{opacity:0;transform:translateY(28px);transition:opacity .65s cubic-bezier(.16,1,.3,1),transform .65s cubic-bezier(.16,1,.3,1)}
.reveal.visible{opacity:1;transform:none}
.reveal-delay-1{transition-delay:.1s}
.reveal-delay-2{transition-delay:.2s}
.reveal-delay-3{transition-delay:.3s}

/* Nav */
nav{
  position:fixed;top:0;left:0;right:0;z-index:100;
  backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);
  background:rgba(13,11,9,.82);border-bottom:1px solid var(--border);
  display:flex;align-items:center;justify-content:space-between;
  padding:0 clamp(20px,5vw,72px);height:60px;
}
.logo{
  font-family:var(--ff-d);font-weight:700;font-size:1rem;
  letter-spacing:-.01em;color:var(--text);text-decoration:none;
}
.nav-cta{
  background:var(--p);color:#fff;padding:9px 20px;
  border-radius:var(--r-sm);font-size:.875rem;font-weight:600;
  text-decoration:none;letter-spacing:.01em;
  transition:opacity .2s,transform .15s,box-shadow .2s;
  box-shadow:0 2px 12px ${primary}44;
}
.nav-cta:hover{opacity:.9;transform:translateY(-1px);box-shadow:0 4px 20px ${primary}55}

/* Hero */
.hero{
  min-height:100svh;display:flex;flex-direction:column;
  align-items:center;justify-content:center;
  text-align:center;padding:100px clamp(20px,5vw,72px) 80px;
  background:
    radial-gradient(ellipse 80% 55% at 50% -5%,${primary}1a 0%,transparent 65%),
    radial-gradient(ellipse 40% 30% at 80% 80%,${secondary}0d 0%,transparent 60%);
}
.pill{
  display:inline-flex;align-items:center;gap:6px;
  background:${primary}1a;border:1px solid ${primary}33;
  color:${secondary};padding:6px 16px;border-radius:999px;
  font-size:.75rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;
  margin-bottom:28px;animation:fadeIn .6s ease forwards;
}
.pill::before{content:'';width:6px;height:6px;border-radius:50%;background:${secondary};flex-shrink:0}
.hero h1{
  font-family:var(--ff-d);font-size:clamp(2.25rem,6vw,4rem);
  font-weight:900;line-height:1.08;letter-spacing:-.035em;
  max-width:900px;
  animation:fadeUp .75s .1s ease both;
}
.hero h1 em{font-style:normal;color:${secondary}}
.hero-sub{
  font-size:clamp(.9375rem,1.8vw,1.1875rem);color:var(--muted);
  max-width:580px;line-height:1.7;margin-top:20px;
  animation:fadeUp .75s .2s ease both;
}
.cta-group{
  display:flex;gap:12px;flex-wrap:wrap;justify-content:center;
  margin-top:36px;animation:fadeUp .75s .3s ease both;
}
.btn-p{
  background:var(--p);color:#fff;padding:14px 32px;border-radius:var(--r-sm);
  font-size:.9375rem;font-weight:600;text-decoration:none;letter-spacing:.01em;
  transition:opacity .2s,transform .15s,box-shadow .2s;display:inline-block;
  box-shadow:0 4px 24px ${primary}44;
}
.btn-p:hover{opacity:.9;transform:translateY(-2px);box-shadow:0 8px 32px ${primary}55}
.btn-g{
  border:1.5px solid var(--border);color:var(--text);
  padding:14px 32px;border-radius:var(--r-sm);
  font-size:.9375rem;font-weight:500;text-decoration:none;
  transition:border-color .2s,background .2s,transform .15s;display:inline-block;
}
.btn-g:hover{border-color:var(--border-h);background:rgba(255,255,255,.05);transform:translateY(-2px)}
.trust{
  display:flex;gap:clamp(16px,3vw,40px);flex-wrap:wrap;justify-content:center;
  margin-top:52px;animation:fadeUp .75s .4s ease both;
  border-top:1px solid var(--border);padding-top:32px;max-width:720px;
}
.trust-item{display:flex;align-items:baseline;gap:6px}
.trust-item strong{color:var(--text);font-weight:700;font-size:1.1rem}
.trust-item span{color:var(--muted);font-size:.8125rem}

/* Content sections */
.sec{padding:clamp(64px,8vw,100px) clamp(20px,5vw,72px)}
.sec-inner{max-width:1200px;margin:0 auto}
.sec-label{
  font-size:.6875rem;font-weight:800;letter-spacing:.14em;text-transform:uppercase;
  color:${secondary};margin-bottom:14px;
}
.sec-title{
  font-family:var(--ff-d);font-size:clamp(1.625rem,3.5vw,2.625rem);
  font-weight:800;line-height:1.15;letter-spacing:-.025em;margin-bottom:14px;
}
.sec-sub{
  color:var(--muted);font-size:1.0625rem;line-height:1.7;
  max-width:520px;margin-bottom:52px;
}

/* Cards */
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:20px}
.grid-4{grid-template-columns:repeat(auto-fit,minmax(260px,1fr))}
.card{
  background:var(--surface);border:1px solid var(--border);
  border-radius:var(--r);padding:28px 26px;
  backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);
  transition:background .25s,border-color .25s,transform .25s,box-shadow .25s;
  position:relative;overflow:hidden;
}
.card::after{
  content:'';position:absolute;inset:0;
  background:radial-gradient(ellipse 80% 60% at 50% -20%,${primary}08,transparent 70%);
  pointer-events:none;
}
.card:hover{
  background:rgba(255,255,255,.07);border-color:var(--border-h);
  transform:translateY(-4px);box-shadow:0 16px 48px rgba(0,0,0,.3);
}
.card-icon{
  width:44px;height:44px;border-radius:10px;
  background:${primary}18;border:1px solid ${primary}2a;
  display:flex;align-items:center;justify-content:center;
  margin-bottom:18px;flex-shrink:0;
}
.card-icon svg{width:22px;height:22px;color:${secondary};stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.card h3{font-size:1.0625rem;font-weight:700;margin-bottom:8px;line-height:1.3;letter-spacing:-.01em}
.card p{color:var(--muted);font-size:.9rem;line-height:1.65}
.card .tag{
  display:inline-block;margin-top:14px;
  font-size:.6875rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;
  color:${secondary};background:${secondary}15;border-radius:4px;padding:3px 8px;
}

/* Stat bar */
.stat-bar{
  background:linear-gradient(135deg,${primary}10 0%,${secondary}0a 50%,transparent 100%);
  border-top:1px solid var(--border);border-bottom:1px solid var(--border);
  padding:clamp(48px,6vw,72px) clamp(20px,5vw,72px);
  display:flex;justify-content:center;
  gap:clamp(32px,5vw,80px);flex-wrap:wrap;text-align:center;
}
.stat-item{display:flex;flex-direction:column;align-items:center;gap:10px;min-width:160px}
.stat-n{
  font-family:var(--ff-d);font-size:clamp(2.5rem,5vw,3.75rem);font-weight:900;
  background:linear-gradient(135deg,${primary},${secondary});
  -webkit-background-clip:text;-webkit-text-fill-color:transparent;
  background-clip:text;line-height:1;letter-spacing:-.03em;
}
.stat-l{color:var(--muted);font-size:.875rem;line-height:1.45;max-width:180px}

/* Process steps */
.steps{
  display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));
  gap:0;counter-reset:step-counter;
}
.step{
  counter-increment:step-counter;
  padding:32px 28px;border-right:1px solid var(--border);
  position:relative;
}
.step:last-child{border-right:none}
.step-num{
  font-family:var(--ff-d);font-size:4rem;font-weight:900;
  line-height:1;margin-bottom:16px;
  background:linear-gradient(135deg,${primary}55,${secondary}33);
  -webkit-background-clip:text;-webkit-text-fill-color:transparent;
  background-clip:text;
}
.step h3{font-size:1.0625rem;font-weight:700;margin-bottom:8px;letter-spacing:-.01em}
.step p{color:var(--muted);font-size:.9rem;line-height:1.65}
.step .duration{
  display:inline-block;margin-top:12px;
  font-size:.6875rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;
  color:var(--faint);
}

/* CTA footer */
.cta-ft{
  text-align:center;
  padding:clamp(80px,10vw,120px) clamp(20px,5vw,72px) 48px;
  background:
    radial-gradient(ellipse 70% 60% at 50% 100%,${primary}16 0%,transparent 65%),
    radial-gradient(ellipse 40% 30% at 20% 0%,${secondary}08 0%,transparent 60%);
}
.cta-ft h2{
  font-family:var(--ff-d);font-size:clamp(1.75rem,3.5vw,2.75rem);
  font-weight:800;letter-spacing:-.025em;margin-bottom:16px;line-height:1.15;
  max-width:680px;margin-left:auto;margin-right:auto;
}
.cta-ft p{color:var(--muted);margin-bottom:36px;font-size:1.0625rem;max-width:500px;margin-left:auto;margin-right:auto;line-height:1.7}
.cta-ft .meta{
  margin-top:48px;color:var(--faint);font-size:.8125rem;
  border-top:1px solid var(--border);padding-top:32px;
}

/* Responsive */
@media(max-width:768px){
  .grid,.grid-4,.steps{grid-template-columns:1fr}
  .step{border-right:none;border-bottom:1px solid var(--border)}
  .step:last-child{border-bottom:none}
  .cta-group{flex-direction:column;align-items:stretch}
  .cta-group a{text-align:center}
  .stat-bar{gap:28px}
  .trust{gap:16px}
}
@media(min-width:769px) and (max-width:1023px){
  .grid{grid-template-columns:repeat(2,1fr)}
  .grid-4{grid-template-columns:repeat(2,1fr)}
}
</style>
</head>
`;
}

function buildStats(stats: Array<{ n: string; l: string }>): string {
  return `
<div class="stat-bar reveal">
  ${stats.map(s => `
  <div class="stat-item">
    <div class="stat-n">${s.n}</div>
    <div class="stat-l">${s.l}</div>
  </div>`).join("")}
</div>`;
}

function buildProcess(companyName: string): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;");
  return `
<section class="sec reveal">
  <div class="sec-inner">
    <div class="sec-label">How It Works</div>
    <div class="sec-title">Live in 6 Weeks, Not 6 Months</div>
    <p class="sec-sub">No bloated agency timelines. No hand-offs to junior developers. We move fast and hand over a system that's already running before the next busy season.</p>
    <div class="steps">
      <div class="step reveal reveal-delay-1">
        <div class="step-num">01</div>
        <h3>Discovery &amp; Architecture</h3>
        <p>We map every friction point in your current operation — order flow, reservation logic, Square POS setup, and staff time costs. You get a full technical blueprint before a single line of code is written.</p>
        <span class="duration">Week 1</span>
      </div>
      <div class="step reveal reveal-delay-2">
        <div class="step-num">02</div>
        <h3>Design, Build &amp; Integrate</h3>
        <p>Your branded platform is built in sprints with weekly demos. ${esc(companyName)} stays in the loop at every stage — you see progress every week, not at the end of month three.</p>
        <span class="duration">Weeks 2–5</span>
      </div>
      <div class="step reveal reveal-delay-3">
        <div class="step-num">03</div>
        <h3>Launch &amp; Iterate</h3>
        <p>Go-live with full team training, a monitored launch window, and 90 days of post-launch support. After that, the system is yours — we document everything and hand over full ownership.</p>
        <span class="duration">Week 6 → ongoing</span>
      </div>
    </div>
  </div>
</section>`;
}

function buildFooter(companyName: string, estimatedValue: string | undefined): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;");
  const valueNote = estimatedValue
    ? `<p>Project investment: <strong style="color:var(--text)">${esc(estimatedValue)}</strong> depending on scope. We'll walk you through options on the call.</p>`
    : "";
  return `
<section class="cta-ft reveal">
  <div class="sec-label">Next Step</div>
  <h2>Ready to build this for ${esc(companyName)}?</h2>
  <p>Book a 30-minute strategy call. We'll show you a live walkthrough tailored to your operation and give you a clear scope and timeline before any commitment.</p>
  ${valueNote}
  <div class="cta-group" style="justify-content:center;margin-top:32px">
    <a href="https://nexoflow.tech" class="btn-p">Book a Strategy Call →</a>
    <a href="https://nexoflow.tech" class="btn-g">View More Case Studies</a>
  </div>
  <p class="meta">© 2026 NexoFlow · Built specifically for ${esc(companyName)} · <a href="https://nexoflow.tech" style="color:var(--muted);text-decoration:none">nexoflow.tech</a></p>
</section>`;
}

function buildJs(leadId: string): string {
  return `
<script>
(function(){
  // Scroll reveal
  var els = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function(entries) {
      entries.forEach(function(e) {
        if (e.isIntersecting) { e.target.classList.add('visible'); io.unobserve(e.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    els.forEach(function(el) { io.observe(el); });
  } else {
    els.forEach(function(el) { el.classList.add('visible'); });
  }

  // Engagement tracking
  try {
    var leadId = ${JSON.stringify(leadId)};
    var sid = sessionStorage.getItem('nf_sid');
    if (!sid) { sid = Math.random().toString(36).slice(2) + Date.now().toString(36); sessionStorage.setItem('nf_sid', sid); }
    var start = Date.now(), maxScroll = 0, ctaClicks = 0;
    document.addEventListener('scroll', function() {
      var h = document.documentElement;
      var pct = h.scrollHeight > h.clientHeight ? Math.round((window.scrollY + h.clientHeight) / h.scrollHeight * 100) : 100;
      if (pct > maxScroll) maxScroll = pct;
    }, { passive: true });
    document.addEventListener('click', function(e) {
      var t = e.target;
      while (t && t !== document.body) {
        if (['A','BUTTON'].includes(t.tagName) || (t.getAttribute && t.getAttribute('role') === 'button')) { ctaClicks++; break; }
        t = t.parentNode;
      }
    });
    function beacon(closing) {
      var data = { sessionId: sid, seconds: Math.round((Date.now()-start)/1000), scroll: maxScroll, ctaClicks: ctaClicks, referrer: document.referrer||'', closing: !!closing };
      var url = '/api/track/' + leadId;
      try { if (navigator.sendBeacon) navigator.sendBeacon(url, JSON.stringify(data)); else fetch(url,{method:'POST',body:JSON.stringify(data),keepalive:true}); } catch(e){}
    }
    var ping = setInterval(beacon, 15000);
    window.addEventListener('beforeunload', function(){ clearInterval(ping); beacon(true); });
    document.addEventListener('visibilitychange', function(){ if (document.visibilityState==='hidden') beacon(false); });
  } catch(e){}
})();
</script>
</body>
</html>`;
}

// ─── AI prompt builder — Claude only writes hero + 2 content sections ─────────

function buildPrompt(params: {
  companyName: string;
  contactName: string;
  jobTitle: string | null;
  industry: string | null;
  painPoints: string | null;
  summary: string;
  offer: string;
  positioning: string;
  targetCustomer: string;
  toneOfVoice: string;
  weaknesses: string[];
  buildOpportunities: Array<{ title: string; description: string; effort: string }>;
  recommendedFeatures: string[];
  demoAngle: string;
  estimatedValue: string;
  primary: string;
  secondary: string;
}): string {
  const {
    companyName, contactName, jobTitle, industry, painPoints,
    summary, offer, positioning, targetCustomer, toneOfVoice,
    weaknesses, buildOpportunities, recommendedFeatures, demoAngle,
    estimatedValue, primary,
  } = params;

  const topWeaknesses = weaknesses.slice(0, 5);
  const topOpportunities = buildOpportunities.slice(0, 4);
  const topFeatures = recommendedFeatures.slice(0, 6);

  const contactLine = [contactName, jobTitle].filter(Boolean).join(", ");

  return `You are a senior conversion copywriter at NexoFlow, a custom software agency. Write personalized HTML for a sales demo page.

OUTPUT RULES — read these before writing anything:
- Output ONLY raw HTML starting with <nav> — no markdown, no \`\`\`, no <!DOCTYPE, no <head>, no <style>
- Every sentence must reference ${companyName}, ${contactName.split(" ")[0]}, or a specific detail from the intel below
- Write in a ${toneOfVoice}, direct, founder-to-founder tone — never corporate or generic
- Keep card <p> descriptions to 2–3 sentences each, punchy and specific
- H1: exactly 8–12 words, no fluff, speaks directly to their biggest pain
- End ONLY with </body></html> (no extra tags after)

═══════════════════ CLIENT INTEL ═══════════════════
COMPANY: ${companyName}
INDUSTRY: ${industry ?? "Business Services"}
CONTACT: ${contactLine}
POSITIONING: "${positioning}"
WHAT THEY SELL: ${offer}
TARGET CUSTOMERS: ${targetCustomer}

BUSINESS SUMMARY:
${summary}

PAIN POINTS (from direct intake):
${painPoints ?? "Manual workflows, no digital infrastructure, losing customers to competitors"}

TOP 5 WEAKNESSES (from website audit):
${topWeaknesses.map((w, i) => `${i + 1}. ${w}`).join("\n")}

WHAT NEXOFLOW BUILDS FOR THEM:
${topOpportunities.map((o, i) => `${i + 1}. ${o.title} [${o.effort} effort]\n   → ${o.description}`).join("\n\n")}

KEY FEATURES:
${topFeatures.map((f, i) => `• ${f}`).join("\n")}

PROJECT VALUE: ${estimatedValue}

DEMO ANGLE TO FOLLOW:
${demoAngle}
═══════════════════════════════════════════════════

CSS CLASSES (already defined — use exactly as written, do not invent new ones):
.hero .pill .hero-sub .cta-group .btn-p .btn-g .trust .trust-item
.sec .sec-inner .sec-label .sec-title .sec-sub
.grid .grid-4 .card .card-icon .card h3 .card p .card .tag
.reveal .reveal-delay-1 .reveal-delay-2 .reveal-delay-3
.logo .nav-cta

SVG ICONS — use inline SVG inside <div class="card-icon"><svg viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">…</svg></div>

═══════ WRITE EXACTLY THESE 4 SECTIONS IN ORDER ═══════

SECTION 1 — <nav>
<nav>
  <span class="logo">[Company] × NexoFlow</span>
  <a href="https://nexoflow.tech" class="nav-cta">Book a Strategy Call</a>
</nav>

SECTION 2 — <section class="hero"> (animate: .pill then h1 then .hero-sub then .cta-group then .trust)
• <div class="pill"> — "Custom demo for [Company]"
• <h1> — 8–12 word punch line targeting their #1 pain. Use <em> tag on 1–3 key words.
• <p class="hero-sub"> — 2 sentences. Reference their situation specifically (competitor, holiday season, phone orders, etc.)
• <div class="cta-group"> — .btn-p "See the Full Demo" + .btn-g "Book a Strategy Call"
• <div class="trust"> — 3 <div class="trust-item"> each with <strong>[stat]</strong><span>[label]</span>. Use real, specific numbers from their pain points.

SECTION 3 — <section class="sec reveal"> — Pain Points
• .sec-label: "What's Costing You"
• .sec-title: strong title about the cost of staying manual
• .sec-sub: 1 sentence
• .grid with 3 .card — top 3 weaknesses. Each card: .card-icon with SVG + <h3> + <p> (2–3 sentences, reference Brixton/Marcus/specific detail) + <span class="tag">Impact</span>

SECTION 4 — <section class="sec reveal"> — Solutions
• .sec-label: "What We Build"
• .sec-title: "Your Complete [Industry] Platform"
• .sec-sub: 1 sentence referencing the demo angle
• .grid.grid-4 with 4 .card — top 4 build opportunities. Each card: .card-icon with SVG + <h3> + <p> (2–3 sentences with outcome + specific metric or reference) + <span class="tag">[Effort] build</span>

END: close with </body></html>`;
}

// ─── POST handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-admin-secret");
  if (!secret || secret !== process.env.ADMIN_REGEN_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json() as { leadId?: string };
  const leadId = body.leadId;
  if (!leadId) return NextResponse.json({ error: "leadId required" }, { status: 400 });

  const [lead] = await db.select().from(leads).where(eq(leads.id, leadId)).limit(1);
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  const profile = lead.businessProfile as BusinessProfile | null;
  const scraped = lead.scrapedProfile as ScrapedProfile | null;

  // ── Resolve brand assets ──
  const brandColors = (profile?.brandColors?.length ? profile.brandColors : scraped?.brandColors) ?? [];
  const primary = brandColors[0] ?? "#7c5cbf";
  const secondary = brandColors[1] ?? "#a78bfa";

  const brandFonts = (profile?.brandFonts?.length ? profile.brandFonts : scraped?.brandFonts) ?? [];
  const industry = lead.industry ?? null;
  const industryKey = (industry ?? "").toLowerCase();

  const displayFont = brandFonts[0]?.trim() ??
    (industryKey.match(/food|restaurant|hospitality|luxury|wine|bar/)  ? "Playfair Display" :
     industryKey.match(/tech|saas|ai|software|finance/)               ? "Plus Jakarta Sans" :
     industryKey.match(/health|medical|wellness/)                      ? "DM Serif Display" :
     "Inter");
  const bodyFont = brandFonts[1]?.trim() ?? "Inter";
  const fontImport = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(displayFont)}:ital,wght@0,400;0,600;0,700;0,900;1,400&family=${encodeURIComponent(bodyFont)}:wght@300;400;500;600&display=swap`;

  const companyName = lead.company ?? [lead.firstName, lead.lastName].filter(Boolean).join(" ") ?? "Your Company";
  const contactName = [lead.firstName, lead.lastName].filter(Boolean).join(" ") || lead.company || "there";

  // ── Build deterministic sections ──
  const head        = buildHead({ companyName, primary, secondary, displayFont, bodyFont, fontImport });
  const statsHtml   = buildStats(getStats(industry));
  const processHtml = buildProcess(companyName);
  const footerHtml  = buildFooter(companyName, profile?.estimatedValue);
  const jsHtml      = buildJs(leadId);

  // ── Build AI prompt ──
  const prompt = buildPrompt({
    companyName,
    contactName,
    jobTitle: lead.jobTitle ?? null,
    industry,
    painPoints: lead.painPoints ?? null,
    summary: profile?.summary ?? `${companyName} is a ${industry ?? "business"} looking to modernise their operations.`,
    offer: profile?.offer ?? lead.painPoints ?? "their core service",
    positioning: profile?.positioningStatement ?? `${companyName} — ready for the next level.`,
    targetCustomer: profile?.targetCustomer ?? "their customers",
    toneOfVoice: profile?.toneOfVoice ?? "professional",
    weaknesses: profile?.visibleWeaknesses ?? (lead.painPoints ? [lead.painPoints] : ["Manual workflows costing time and revenue"]),
    buildOpportunities: profile?.buildOpportunities ?? [],
    recommendedFeatures: profile?.recommendedFeatures ?? ["Online ordering", "Automation", "CRM", "Analytics"],
    demoAngle: profile?.demoAngle ?? `Show ${companyName} a complete digital platform that solves their biggest operational challenges.`,
    estimatedValue: profile?.estimatedValue ?? "Contact us for pricing",
    primary,
    secondary,
  });

  // ── Call Claude for hero + pain points + solutions only ──
  const aiResponse = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4000,
    messages: [{ role: "user", content: prompt }],
  });

  let aiHtml = aiResponse.content[0]?.type === "text" ? aiResponse.content[0].text : "";
  if (!aiHtml) return NextResponse.json({ error: "Empty AI response" }, { status: 500 });

  // Strip any accidental code fences
  aiHtml = aiHtml.replace(/^```(?:html)?\n?/i, "").replace(/\n?```\s*$/i, "").trim();
  // Strip premature </body></html> if Claude added it mid-stream
  aiHtml = aiHtml.replace(/<\/body>\s*<\/html>\s*$/i, "").trim();

  // ── Assemble full page ──
  const demoHtml = [head, aiHtml, statsHtml, processHtml, footerHtml, jsHtml].join("\n");

  // ── Persist ──
  let clientId = lead.clientId;
  if (!clientId) {
    const [newClient] = await db.insert(clients).values({
      name: contactName, email: lead.email ?? null, phone: lead.phone ?? null,
      company: lead.company ?? null, website: lead.website ?? null,
      industry: lead.industry ?? null, teamId: lead.teamId ?? null,
    }).returning();
    clientId = newClient?.id ?? null;
  }

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
    clientId, projectId, demoHtml, demoUrl,
    demoBlobUrl: blobUrl, shareToken,
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
    aiTokensUsed: aiResponse.usage.output_tokens,
  });
}
