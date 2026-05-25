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

// ─── Booking URL — update this to your Calendly/Cal.com link ─────────────────
const BOOKING_URL = process.env.BOOKING_URL ?? "https://nexoflow.tech/book";

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
  legal: [
    { n: "–41%", l: "Reduction in document processing time after automated client intake and matter management" },
    { n: "3.2×", l: "More matters handled per fee-earner after deploying practice management automation" },
    { n: "89%", l: "Client satisfaction improvement after launching a self-serve portal for case updates" },
  ],
  real_estate: [
    { n: "+52%", l: "Increase in qualified leads after launching AI-powered property matching and follow-up" },
    { n: "67%", l: "Faster lead-to-showing conversion with automated nurture sequences" },
    { n: "4.1×", l: "Higher client retention for agents using a custom CRM vs generic off-the-shelf tools" },
  ],
  fitness: [
    { n: "+44%", l: "Increase in member retention after launching automated re-engagement and progress tracking" },
    { n: "78%", l: "Of members prefer digital class booking and check-in over phone or walk-in" },
    { n: "3.5×", l: "Revenue uplift from automated personal training upsell triggered post-class" },
  ],
  education: [
    { n: "+61%", l: "Improvement in course completion rates with automated progress nudges and check-ins" },
    { n: "73%", l: "Reduction in admin overhead after launching a self-serve student and parent portal" },
    { n: "4.2×", l: "Higher re-enrollment rate for students who receive personalised learning path recommendations" },
  ],
  finance: [
    { n: "–58%", l: "Reduction in manual data entry for accountants after automated document parsing" },
    { n: "91%", l: "Of clients prefer real-time financial dashboards over monthly PDF reports" },
    { n: "3.9×", l: "Faster client onboarding after replacing manual intake with an automated data room" },
  ],
  logistics: [
    { n: "+37%", l: "Improvement in on-time delivery rate after automated routing and exception management" },
    { n: "62%", l: "Reduction in customer support calls after launching real-time shipment tracking" },
    { n: "4.6×", l: "ROI on route optimisation software vs. manual dispatch planning" },
  ],
  construction: [
    { n: "–43%", l: "Reduction in project cost overruns after automated budget tracking and approval workflows" },
    { n: "71%", l: "Faster tender-to-contract conversion with digital proposals and e-signature" },
    { n: "3.7×", l: "Improvement in subcontractor coordination after replacing email chains with a project portal" },
  ],
  professional_services: [
    { n: "+39%", l: "Revenue per consultant after deploying automated client reporting and project dashboards" },
    { n: "76%", l: "Reduction in proposal turnaround time with templated scoping and e-signature" },
    { n: "4.3×", l: "Client retention improvement for agencies using a branded client portal vs email updates" },
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
  if (k.match(/legal|law|solicitor|attorney|barrister/)) return STATS.legal!;
  if (k.match(/real.estate|property|realty|letting|mortgage|estate.agent/)) return STATS.real_estate!;
  if (k.match(/fitness|gym|yoga|crossfit|sport|training.studio/)) return STATS.fitness!;
  if (k.match(/education|school|university|college|training|e-learning|tutoring|academy/)) return STATS.education!;
  if (k.match(/finance|accounting|fintech|bank|insurance|wealth|advisory|bookkeep/)) return STATS.finance!;
  if (k.match(/logistics|shipping|freight|transport|haulage|delivery|courier/)) return STATS.logistics!;
  if (k.match(/construction|building|contractor|civil|trades|architecture|surveying/)) return STATS.construction!;
  if (k.match(/consulting|agency|marketing|pr|recruitment|staffing|advisory/)) return STATS.professional_services!;
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

function buildProcess(companyName: string, industry: string | null): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;");
  const ind = (industry ?? "").toLowerCase();
  const co = esc(companyName);

  type Step = { h: string; p: string; d: string };

  let title: string;
  let sub: string;
  let steps: [Step, Step, Step];

  if (ind.match(/restaurant|food|dining|smokehouse|bbq|hospitality|cafe|bar|beverage/)) {
    title = "Live in 6 Weeks, Not 6 Months";
    sub = "No bloated agency timelines. No hand-offs to junior developers. We move fast and hand over a system that's already running before the next busy season.";
    steps = [
      { h: "Discovery &amp; Architecture", p: `We map every friction point in your operation — order flow, reservation logic, POS integration, and staff time costs. You get a full technical blueprint before a single line of code is written.`, d: "Week 1" },
      { h: "Design, Build &amp; Integrate", p: `Your branded platform is built in weekly sprints. ${co} sees working software at every stage — not a slideshow at the end of month three.`, d: "Weeks 2–5" },
      { h: "Launch &amp; Iterate", p: `Go-live with full team training, a monitored launch, and 90 days of post-launch support. The system is yours — fully documented and handed over.`, d: "Week 6 → ongoing" },
    ];
  } else if (ind.match(/saas|software|tech|ai|platform|dev/)) {
    title = "Your Product, Shipped in 6 Weeks";
    sub = "No hand-offs to juniors. No missed deadlines. Weekly sprint demos so you see exactly what's being built before it goes live.";
    steps = [
      { h: "Discovery &amp; Architecture", p: `We audit your current workflow, define the data model, map integrations, and document every user flow. A complete technical architecture before a single line of code.`, d: "Week 1" },
      { h: "Build &amp; Ship in Sprints", p: `Your product is built in focused weekly sprints. ${co} reviews every sprint and signs off before we move forward — full transparency at every stage.`, d: "Weeks 2–5" },
      { h: "Launch &amp; Scale", p: `Production deploy with full test coverage, documentation, and a 90-day support period. You own the code, the infrastructure, and the roadmap from day one.`, d: "Week 6 → ongoing" },
    ];
  } else if (ind.match(/ecommerce|e-commerce|retail|shop|store/)) {
    title = "Your Commerce Platform, Live in 4–6 Weeks";
    sub = "No templates, no limitations, no agency hand-offs. A store built to your exact workflow, with weekly demos the whole way through.";
    steps = [
      { h: "Discovery &amp; Store Design", p: `We map your product catalog, checkout logic, inventory management, and fulfillment flow. A complete platform blueprint — nothing gets built without your sign-off.`, d: "Week 1" },
      { h: "Build, Integrate &amp; Test", p: `Your store is built with real product data from the start. ${co} sees the platform working with your actual catalog before anything goes live.`, d: "Weeks 2–5" },
      { h: "Launch &amp; Optimise", p: `Go-live with payment testing, performance tuning, and a monitored launch window. Then 90 days of post-launch support as you scale traffic and revenue.`, d: "Week 6 → ongoing" },
    ];
  } else if (ind.match(/health|medical|dental|clinic|therapy|wellness/)) {
    title = "Your Practice Platform, Live in 6 Weeks";
    sub = "Purpose-built for your workflow, your compliance requirements, and your patients — not a generic tool bolted together.";
    steps = [
      { h: "Discovery &amp; Compliance Review", p: `We map your patient workflow — intake, scheduling, follow-up, and billing — and review compliance requirements from the start. A full technical blueprint before any code is written.`, d: "Week 1" },
      { h: "Build &amp; Test With Your Team", p: `The platform is built to spec and tested against your real workflows. ${co}'s team reviews every sprint before anything touches patient data.`, d: "Weeks 2–5" },
      { h: "Launch, Train &amp; Support", p: `Go-live with staff training, a monitored rollout, and 90 days of post-launch support. Full documentation so your team runs it independently from day one.`, d: "Week 6 → ongoing" },
    ];
  } else if (ind.match(/real.estate|property|realty|letting|mortgage|estate.agent/)) {
    title = "Your Property Platform, Live in 6 Weeks";
    sub = "Built for how you actually work — not another CRM that needs five plug-ins to function.";
    steps = [
      { h: "Discovery &amp; Workflow Map", p: `We audit your current lead capture, listing management, and client communication flow. You get a complete platform blueprint — not a demo, a real plan.`, d: "Week 1" },
      { h: "Build, Brand &amp; Connect", p: `Your platform is built with live listing feeds, CRM integration, and your brand. ${co} reviews every sprint as features are delivered.`, d: "Weeks 2–5" },
      { h: "Launch, Train &amp; Grow", p: `Go-live with full agent training, a monitored launch, and 90 days of support. You own the platform and control your data — no vendor lock-in.`, d: "Week 6 → ongoing" },
    ];
  } else if (ind.match(/legal|law|solicitor|attorney|barrister/)) {
    title = "Your Legal Platform, Live in 6 Weeks";
    sub = "Custom-built for your practice — not a generic case management tool that needs three workarounds to handle your workflow.";
    steps = [
      { h: "Discovery &amp; Process Map", p: `We map your matter workflow, client intake, billing logic, and document management requirements. A complete technical blueprint — reviewed and signed off before any code is written.`, d: "Week 1" },
      { h: "Build &amp; Test Against Your Cases", p: `The platform is built with your actual matter types and document templates. ${co}'s team validates every sprint before it handles live client data.`, d: "Weeks 2–5" },
      { h: "Launch, Train &amp; Support", p: `Go-live with full team training, a monitored rollout, and 90 days of post-launch support. Every process is documented so your team can run it independently.`, d: "Week 6 → ongoing" },
    ];
  } else {
    // Generic professional services / catch-all
    title = "Your Custom Platform, Live in 6 Weeks";
    sub = "No bloated agency timelines. No hand-offs to junior developers. Weekly sprint demos so you see exactly what's being built.";
    steps = [
      { h: "Discovery &amp; Architecture", p: `We map every friction point in your current operation — workflows, integrations, data flows, and team time costs. A full technical blueprint before a single line of code is written.`, d: "Week 1" },
      { h: "Design, Build &amp; Integrate", p: `Your platform is built in sprints with weekly demos. ${co} stays in the loop at every stage — you see real progress every week, not a presentation at the end of the project.`, d: "Weeks 2–5" },
      { h: "Launch &amp; Iterate", p: `Go-live with full team training, a monitored launch window, and 90 days of post-launch support. After that, the system is yours — fully documented and handed over.`, d: "Week 6 → ongoing" },
    ];
  }

  return `
<section class="sec reveal">
  <div class="sec-inner">
    <div class="sec-label">How It Works</div>
    <div class="sec-title">${title}</div>
    <p class="sec-sub">${sub}</p>
    <div class="steps">
      <div class="step reveal reveal-delay-1">
        <div class="step-num">01</div>
        <h3>${steps[0].h}</h3>
        <p>${steps[0].p}</p>
        <span class="duration">${steps[0].d}</span>
      </div>
      <div class="step reveal reveal-delay-2">
        <div class="step-num">02</div>
        <h3>${steps[1].h}</h3>
        <p>${steps[1].p}</p>
        <span class="duration">${steps[1].d}</span>
      </div>
      <div class="step reveal reveal-delay-3">
        <div class="step-num">03</div>
        <h3>${steps[2].h}</h3>
        <p>${steps[2].p}</p>
        <span class="duration">${steps[2].d}</span>
      </div>
    </div>
  </div>
</section>`;
}

function buildFooter(companyName: string, estimatedValue: string | undefined, bookingUrl: string): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;");
  const valueNote = estimatedValue
    ? `<p>Project investment: <strong style="color:var(--text)">${esc(estimatedValue)}</strong> depending on scope. We'll walk you through every option on the call — no commitment required.</p>`
    : "";
  return `
<section class="cta-ft reveal">
  <div class="sec-label">Next Step</div>
  <h2>Ready to build this for ${esc(companyName)}?</h2>
  <p>Book a free 30-minute strategy call. We'll show you a live walkthrough built around your operation and hand you a clear scope, timeline, and price before you commit to anything.</p>
  ${valueNote}
  <div class="cta-group" style="justify-content:center;margin-top:32px">
    <a href="${bookingUrl}" class="btn-p">Book a Free Strategy Call →</a>
    <a href="https://nexoflow.tech/case-studies" class="btn-g">View Case Studies</a>
  </div>
  <p class="meta">© 2026 NexoFlow · This demo was built specifically for ${esc(companyName)} · <a href="https://nexoflow.tech" style="color:var(--muted);text-decoration:none">nexoflow.tech</a></p>
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
  roiEstimate: string | null;
  urgencySignals: string[];
  competitorContext: string | null;
  industryFit: string | null;
  primary: string;
  secondary: string;
}): string {
  const {
    companyName, contactName, jobTitle, industry, painPoints,
    summary, offer, positioning, targetCustomer, toneOfVoice,
    weaknesses, buildOpportunities, recommendedFeatures, demoAngle,
    estimatedValue, roiEstimate, urgencySignals, competitorContext, industryFit,
  } = params;

  const topWeaknesses = weaknesses.slice(0, 5);
  const topOpportunities = buildOpportunities.slice(0, 4);
  const topFeatures = recommendedFeatures.slice(0, 6);
  const firstName = contactName.split(" ")[0];

  const contactLine = [contactName, jobTitle].filter(Boolean).join(", ");

  const roiBlock = roiEstimate
    ? `\nROI ESTIMATE:\n${roiEstimate}`
    : "";

  const urgencyBlock = urgencySignals.length > 0
    ? `\nURGENCY SIGNALS (use in hero-sub or card copy):\n${urgencySignals.map((s) => `• ${s}`).join("\n")}`
    : "";

  const competitorBlock = competitorContext
    ? `\nCOMPETITOR / MARKET CONTEXT:\n${competitorContext}`
    : "";

  const industryFitBlock = industryFit
    ? `\nWHY NEXOFLOW FITS THIS INDUSTRY:\n${industryFit}`
    : "";

  return `You are a senior conversion copywriter at NexoFlow, a custom software agency. Write personalized HTML for a sales demo page.

OUTPUT RULES — read these before writing anything:
- Output ONLY raw HTML starting with <nav> — no markdown, no \`\`\`, no <!DOCTYPE, no <head>, no <style>
- Every sentence must reference ${companyName}, ${firstName}, or a specific detail from the CLIENT INTEL below
- Write in a ${toneOfVoice}, direct, founder-to-founder tone — never corporate or generic
- Keep card <p> descriptions to 2–3 sentences each, punchy and specific
- H1: exactly 8–12 words, no fluff, speaks directly to their single biggest pain
- Use urgency signals and ROI data wherever they appear below — these are conversion gold
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
${topWeaknesses.map((w, i) => `${i + 1}. ${w}`).join("\n")}${roiBlock}${urgencyBlock}${competitorBlock}${industryFitBlock}

WHAT NEXOFLOW BUILDS FOR THEM:
${topOpportunities.map((o, i) => `${i + 1}. ${o.title} [${o.effort} effort]\n   → ${o.description}`).join("\n\n")}

KEY FEATURES:
${topFeatures.map((f) => `• ${f}`).join("\n")}

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
  <a href="${BOOKING_URL}" class="nav-cta">Book a Free Call</a>
</nav>

SECTION 2 — <section class="hero"> (animate: .pill then h1 then .hero-sub then .cta-group then .trust)
• <div class="pill"> — "Built specifically for ${companyName}"
• <h1> — 8–12 word punch line targeting their #1 pain. Use <em> on 1–3 key words. Draw from urgency signals if available.
• <p class="hero-sub"> — 2 sentences. Reference their specific situation from the intel (competitor context, urgency signals, a weakness they're clearly suffering from right now).
• <div class="cta-group"> — .btn-p "Book a Free Strategy Call →" linking to ${BOOKING_URL} + .btn-g "See What We Build" linking to #solutions
• <div class="trust"> — 3 <div class="trust-item"> with <strong>[stat]</strong><span>[label]</span>. Draw from ROI estimate and pain points — make numbers specific and credible.

SECTION 3 — <section class="sec reveal" id="pain"> — Pain Points
• .sec-label: "What's Costing You"
• .sec-title: strong, specific title about the cost of staying the same — not generic
• .sec-sub: 1 sentence tying to ${companyName}'s exact situation
• .grid with 3 .card — top 3 weaknesses. Each card: .card-icon with SVG + <h3> (problem name) + <p> (2–3 sentences referencing ${companyName}/${firstName}/specific details from the intel) + <span class="tag">Impact</span>

SECTION 4 — <section class="sec reveal" id="solutions"> — Solutions
• .sec-label: "What We Build"
• .sec-title: "Your Complete ${industry ?? "Business"} Platform" — make it feel purpose-built
• .sec-sub: 1 sentence referencing the demo angle and ${companyName} specifically
• .grid.grid-4 with 4 .card — top 4 build opportunities. Each card: .card-icon with SVG + <h3> (feature/system name) + <p> (2–3 sentences: what it does + the specific outcome for ${companyName} + a metric or reference) + <span class="tag">[Effort] build</span>

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
  const processHtml = buildProcess(companyName, industry);
  const footerHtml  = buildFooter(companyName, profile?.estimatedValue, BOOKING_URL);
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
    roiEstimate: profile?.roiEstimate ?? null,
    urgencySignals: profile?.urgencySignals ?? [],
    competitorContext: profile?.competitorContext ?? null,
    industryFit: profile?.industryFit ?? null,
    primary,
    secondary,
  });

  // ── Call Claude for hero + pain points + solutions only ──
  const aiResponse = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 6000,
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
