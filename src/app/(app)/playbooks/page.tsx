"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Globe, Smartphone, Monitor, Box, LayoutDashboard,
  Store, Wrench, Brain, ShoppingBag, User,
  CheckSquare, Clock, DollarSign, AlertTriangle, ChevronRight, BookOpen,
} from "lucide-react";

const PLAYBOOKS = [
  {
    id: "website",
    label: "Website",
    icon: Globe,
    color: "hsl(220, 90%, 62%)",
    budget: "$4.5K – $15K",
    timeline: "2–6 weeks",
    stack: "Next.js 16 · Tailwind v4 · Vercel",
    phases: [
      { name: "Discovery", duration: "Week 1", deliverables: ["Sitemap & information architecture", "Wireframes for all key pages", "Content brief handed to client", "Tech decisions locked (CMS, analytics)"] },
      { name: "Design", duration: "Week 2–3", deliverables: ["Figma designs for all pages (desktop + mobile)", "Brand-consistent component library", "Client sign-off on design"] },
      { name: "Build", duration: "Week 3–5", deliverables: ["Next.js App Router implementation", "CMS integration (Sanity or Contentful)", "Responsive across all breakpoints", "SEO meta tags, OG images, sitemap.xml"] },
      { name: "Launch", duration: "Week 5–6", deliverables: ["QA pass across devices/browsers", "PageSpeed score > 90", "Domain, SSL, analytics live", "Client handover & training"] },
    ],
    checklist: [
      "Core Web Vitals: LCP < 2.5s, CLS < 0.1",
      "All images served via Next.js Image component",
      "sitemap.xml + robots.txt deployed",
      "Google Analytics / PostHog installed",
      "Contact forms working with Resend",
      "OG images on all shareable pages",
      "SSL and WWW redirect configured",
      "404 and error pages exist",
    ],
    risks: [
      { risk: "Scope creep on page count", likelihood: "High", mitigation: "Agree exact page list in discovery, charge for additions" },
      { risk: "Content delays from client", likelihood: "High", mitigation: "Define content freeze date in contract, dummy content fills if missed" },
      { risk: "Brand guidelines not ready", likelihood: "Medium", mitigation: "Agree brand deliverables as a client responsibility item in scope" },
    ],
  },
  {
    id: "web_app",
    label: "Web App",
    icon: LayoutDashboard,
    color: "hsl(262, 83%, 68%)",
    budget: "$10K – $45K",
    timeline: "6–16 weeks",
    stack: "Next.js 16 · tRPC · Drizzle + Neon · Auth.js",
    phases: [
      { name: "Discovery", duration: "Week 1–2", deliverables: ["User stories & job-to-be-done defined", "Data model designed", "API surface documented", "Tech stack confirmed"] },
      { name: "Architecture", duration: "Week 2", deliverables: ["DB schema finalised in Drizzle", "tRPC routers defined", "Auth flow designed", "Deployment architecture set"] },
      { name: "Core Build", duration: "Week 3–10", deliverables: ["Auth (credentials + OAuth)", "Core CRUD operations", "Role-based access control", "Email notifications via Resend"] },
      { name: "Polish & QA", duration: "Week 10–13", deliverables: ["Loading/error/empty states on all views", "Mobile responsive", "Vitest unit tests for business logic", "Performance audit passed"] },
      { name: "Launch", duration: "Week 13–16", deliverables: ["Sentry error monitoring configured", "PostHog analytics live", "Production deployment to Vercel", "Client handover & training docs"] },
    ],
    checklist: [
      "All routes protected by auth middleware",
      "Zod validation on every API input",
      "Rate limiting on public endpoints",
      "Drizzle migrations checked in to git",
      "Environment variables validated with @t3-oss/env-nextjs",
      "Loading and error states on every async operation",
      "Mobile responsive at 320px minimum",
      "Sentry DSN configured in production",
    ],
    risks: [
      { risk: "Auth complexity underestimated", likelihood: "Medium", mitigation: "Use Auth.js v5 defaults, only customise what's needed" },
      { risk: "Integration with existing client systems", likelihood: "High", mitigation: "Spike integrations in week 1, surface blockers early" },
      { risk: "DB schema changes mid-build", likelihood: "Medium", mitigation: "Freeze schema after architecture phase, charge for late changes" },
    ],
  },
  {
    id: "mobile_app",
    label: "Mobile App",
    icon: Smartphone,
    color: "hsl(142, 68%, 52%)",
    budget: "$22K – $75K",
    timeline: "12–24 weeks",
    stack: "React Native · Expo SDK 52 · Expo Router v4 · EAS",
    phases: [
      { name: "Discovery", duration: "Week 1–2", deliverables: ["Platform decision (iOS only, Android only, or both)", "Offline requirements defined", "Push notification strategy", "App Store / Play Store accounts confirmed"] },
      { name: "Design", duration: "Week 2–4", deliverables: ["Native-feeling UI (iOS & Android variants)", "Navigation flows in Figma", "Gesture interactions defined", "Prototype signed off"] },
      { name: "Core Build", duration: "Week 4–16", deliverables: ["Expo Router navigation structure", "Authentication + secure storage", "Core features built", "Push notifications via Expo + FCM"] },
      { name: "Native Features", duration: "Week 12–18", deliverables: ["Camera/gallery access if required", "Offline sync with MMKV + React Query", "Background fetch configured", "OTA updates via Expo Updates"] },
      { name: "Submission", duration: "Week 18–24", deliverables: ["EAS Build production binaries", "App Store review passed", "Play Store review passed", "Monitoring via Sentry"] },
    ],
    checklist: [
      "Deep linking configured for both platforms",
      "App icons and splash screens at all required resolutions",
      "Push notification permissions handled gracefully",
      "Offline behaviour tested (airplane mode flows)",
      "Tested on physical device (not just simulator)",
      "App Store screenshots at all required sizes",
      "Privacy policy URL in app store listing",
      "OTA update strategy configured",
    ],
    risks: [
      { risk: "App Store rejection", likelihood: "Medium", mitigation: "Follow Apple HIG, no web-view-only apps, review guidelines before submission" },
      { risk: "Native module conflicts", likelihood: "Medium", mitigation: "Use Expo SDK-compatible packages, avoid bare workflow unless necessary" },
      { risk: "Android/iOS behaviour differences", likelihood: "High", mitigation: "Test on real devices for both platforms weekly throughout build" },
    ],
  },
  {
    id: "saas",
    label: "SaaS Product",
    icon: Box,
    color: "hsl(207, 90%, 60%)",
    budget: "$30K – $100K",
    timeline: "16–32 weeks",
    stack: "Next.js 16 · tRPC · Drizzle · Auth.js · Stripe",
    phases: [
      { name: "Discovery", duration: "Week 1–3", deliverables: ["ICP (ideal customer profile) defined", "Pricing model decided (per-seat, usage, flat)", "Multi-tenancy strategy (schema-per-tenant or row-level)", "MVP feature set agreed"] },
      { name: "Architecture", duration: "Week 3–4", deliverables: ["Multi-tenant data model designed", "Stripe plan/product structure configured", "Billing lifecycle mapped (trial → paid → churn)", "Onboarding flow designed"] },
      { name: "Core Platform", duration: "Week 4–16", deliverables: ["Org/workspace model built", "Team invitations & role management", "Stripe Checkout + Customer Portal", "Webhook handlers for subscription events"] },
      { name: "Product Features", duration: "Week 12–24", deliverables: ["Core product functionality", "Usage metering if applicable", "Email sequences via Resend", "In-app notifications"] },
      { name: "Growth & Launch", duration: "Week 24–32", deliverables: ["Marketing site + SEO", "Analytics: PostHog funnels + retention", "Intercom or in-app support", "Status page"] },
    ],
    checklist: [
      "Stripe webhooks verified with signing secret",
      "Subscription state synced to DB on every webhook event",
      "Trial-to-paid conversion email sequence live",
      "Org isolation verified: no cross-tenant data leaks",
      "Feature flags per subscription tier enforced",
      "Customer portal for self-serve billing changes",
      "Usage limits enforced server-side, not just UI",
      "GDPR: data export and deletion endpoints",
    ],
    risks: [
      { risk: "Stripe edge cases (failed payments, upgrades, downgrades)", likelihood: "High", mitigation: "Test every billing state in Stripe test mode before go-live" },
      { risk: "Multi-tenancy data isolation bugs", likelihood: "Medium", mitigation: "Add tenant context to every query, automated tests for cross-tenant access" },
      { risk: "Churn before product-market fit", likelihood: "High", mitigation: "Ship to 5 design partners before building v2 features" },
    ],
  },
  {
    id: "ai_product",
    label: "AI Product",
    icon: Brain,
    color: "hsl(280, 85%, 65%)",
    budget: "$10K – $38K add-on",
    timeline: "4–12 weeks",
    stack: "Claude Sonnet 4.6 · @anthropic-ai/sdk · pgvector · Vercel",
    phases: [
      { name: "Discovery", duration: "Week 1", deliverables: ["LLM use case defined (generation, classification, RAG, agents)", "Context sources identified", "Latency & cost budget agreed", "Evaluation criteria for outputs"] },
      { name: "Prototype", duration: "Week 1–2", deliverables: ["Basic prompt working in Anthropic playground", "Streaming response implemented", "Token budget estimated at production scale"] },
      { name: "Production Build", duration: "Week 2–8", deliverables: ["Streaming SSE API route in Next.js", "Prompt versioning system", "Context injection from knowledge base", "Fallback for API failures"] },
      { name: "RAG (if applicable)", duration: "Week 6–10", deliverables: ["pgvector installed on Neon", "Embedding pipeline for documents", "Similarity search API", "Chunking strategy implemented"] },
      { name: "Observability", duration: "Week 8–12", deliverables: ["LangSmith or Langfuse integrated", "Token usage dashboards", "Output quality evals", "Cost per request monitored"] },
    ],
    checklist: [
      "Prompt versioned and stored in code (not DB)",
      "System prompt clearly separates persona from knowledge",
      "Streaming responses handle partial JSON gracefully",
      "Rate limiting on AI endpoints",
      "Fallback response if API is down",
      "User PII not logged in prompts",
      "Cost alerts set in Anthropic dashboard",
      "Max_tokens budget set on every API call",
    ],
    risks: [
      { risk: "LLM output quality inconsistency", likelihood: "High", mitigation: "Eval suite with golden test cases, human review before major prompt changes" },
      { risk: "Token costs exceeding budget at scale", likelihood: "Medium", mitigation: "Haiku 4.5 for classification, Sonnet 4.6 only for generation. Cache embeddings." },
      { risk: "Prompt injection attacks", likelihood: "Medium", mitigation: "Separate system context from user input, validate and sanitise user inputs" },
    ],
  },
  {
    id: "desktop_app",
    label: "Desktop App",
    icon: Monitor,
    color: "hsl(35, 90%, 58%)",
    budget: "$18K – $65K",
    timeline: "12–20 weeks",
    stack: "Tauri v2 · React · TypeScript · Vite",
    phases: [
      { name: "Discovery", duration: "Week 1–2", deliverables: ["Platform targets confirmed (Windows, Mac, Linux)", "System access requirements (files, OS APIs)", "Distribution method (direct download, app stores, MSI/DMG)", "Auto-update strategy"] },
      { name: "Core Build", duration: "Week 2–12", deliverables: ["Tauri v2 project scaffold with React frontend", "Rust commands for system access", "Local data with SQLite via Tauri SQL plugin", "IPC between frontend and Rust backend"] },
      { name: "Distribution", duration: "Week 12–16", deliverables: ["Code signing certificates (Apple Developer, Windows)", "Auto-update server configured", "Tauri Updater integrated", "CI/CD for multi-platform builds"] },
      { name: "Launch", duration: "Week 16–20", deliverables: ["Notarised macOS build", "MSIX or NSIS Windows installer", "Crash reporting via Sentry", "Documentation for installation"] },
    ],
    checklist: [
      "macOS app notarised with Apple Developer account",
      "Windows installer signed to avoid SmartScreen warnings",
      "Auto-updater tested with actual release flow",
      "File permissions requested only when needed",
      "Rust panics handled gracefully",
      "App works offline by default",
      "Tested on minimum spec hardware",
    ],
    risks: [
      { risk: "macOS notarisation delays", likelihood: "Medium", mitigation: "Start Apple Developer account setup in week 1, allow 1 week buffer" },
      { risk: "Tauri Rust compilation complexity", likelihood: "Low", mitigation: "Use official Tauri plugins for system features, avoid custom Rust unless necessary" },
    ],
  },
];

function RiskBadge({ likelihood }: { likelihood: string }) {
  const styles: Record<string, { bg: string; color: string }> = {
    High:   { bg: "hsl(0 72% 58% / 0.12)",   color: "hsl(0, 72%, 58%)" },
    Medium: { bg: "hsl(35 90% 58% / 0.12)",  color: "hsl(35, 90%, 58%)" },
    Low:    { bg: "hsl(142 68% 45% / 0.12)", color: "hsl(142, 68%, 45%)" },
  };
  const s = styles[likelihood] ?? styles.Medium!;
  return (
    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ background: s.bg, color: s.color }}>
      {likelihood}
    </span>
  );
}

export default function PlaybooksPage() {
  const [activeId, setActiveId] = useState(PLAYBOOKS[0]!.id);
  const playbook = PLAYBOOKS.find((p) => p.id === activeId)!;
  const Icon = playbook.icon;

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside
        className="w-60 shrink-0 flex flex-col"
        style={{ borderRight: "1px solid var(--surface-border)", background: "var(--surface-card)" }}
      >
        <div className="p-4 shrink-0" style={{ borderBottom: "1px solid var(--surface-border)" }}>
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4" style={{ color: "var(--brand-primary)" }} />
            <h1 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>Build Playbooks</h1>
          </div>
          <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>
            NexoFlow's production build guides
          </p>
        </div>
        <nav className="flex-1 p-2">
          {PLAYBOOKS.map((pb) => {
            const PbIcon = pb.icon;
            const active = pb.id === activeId;
            return (
              <button
                key={pb.id}
                onClick={() => setActiveId(pb.id)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all mb-0.5"
                style={
                  active
                    ? { background: `${pb.color}15`, color: pb.color }
                    : { color: "var(--text-secondary)" }
                }
              >
                <PbIcon className="w-4 h-4 shrink-0" />
                <div className="text-left">
                  <div className="text-xs font-semibold">{pb.label}</div>
                  <div className="text-[10px]" style={{ color: active ? pb.color : "var(--text-muted)", opacity: 0.8 }}>{pb.budget}</div>
                </div>
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-3xl mx-auto p-8">
          {/* Header */}
          <div className="flex items-start justify-between mb-8">
            <div className="flex items-center gap-4">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center"
                style={{ background: `${playbook.color}15` }}
              >
                <Icon className="w-6 h-6" style={{ color: playbook.color }} />
              </div>
              <div>
                <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>{playbook.label} Playbook</h1>
                <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{playbook.stack}</p>
              </div>
            </div>
            <div className="flex gap-3 text-right">
              <div>
                <div className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>BUDGET</div>
                <div className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>{playbook.budget}</div>
              </div>
              <div>
                <div className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>TIMELINE</div>
                <div className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>{playbook.timeline}</div>
              </div>
            </div>
          </div>

          {/* Phases */}
          <section className="mb-8">
            <h2 className="text-sm font-bold uppercase tracking-wider mb-4" style={{ color: "var(--text-muted)" }}>Build Phases</h2>
            <div className="space-y-3">
              {playbook.phases.map((phase, i) => (
                <div
                  key={phase.name}
                  className="rounded-xl p-5"
                  style={{ background: "var(--surface-card)", border: "1px solid var(--surface-border)" }}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div
                      className="w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold"
                      style={{ background: `${playbook.color}20`, color: playbook.color }}
                    >
                      {i + 1}
                    </div>
                    <div>
                      <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{phase.name}</span>
                      <span className="ml-2 text-xs" style={{ color: "var(--text-muted)" }}>
                        <Clock className="w-3 h-3 inline mr-1" />{phase.duration}
                      </span>
                    </div>
                  </div>
                  <ul className="space-y-1.5 ml-9">
                    {phase.deliverables.map((d) => (
                      <li key={d} className="flex items-start gap-2 text-xs" style={{ color: "var(--text-secondary)" }}>
                        <ChevronRight className="w-3 h-3 shrink-0 mt-0.5" style={{ color: playbook.color }} />
                        {d}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>

          {/* Launch checklist */}
          <section className="mb-8">
            <h2 className="text-sm font-bold uppercase tracking-wider mb-4" style={{ color: "var(--text-muted)" }}>
              <CheckSquare className="w-3.5 h-3.5 inline mr-2" />
              Launch Checklist
            </h2>
            <div
              className="rounded-xl p-5"
              style={{ background: "var(--surface-card)", border: "1px solid var(--surface-border)" }}
            >
              <div className="grid grid-cols-1 gap-2">
                {playbook.checklist.map((item) => (
                  <div key={item} className="flex items-start gap-2.5 text-sm" style={{ color: "var(--text-secondary)" }}>
                    <div className="w-4 h-4 rounded border mt-0.5 shrink-0" style={{ borderColor: playbook.color, background: `${playbook.color}10` }} />
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Risks */}
          <section className="mb-8">
            <h2 className="text-sm font-bold uppercase tracking-wider mb-4" style={{ color: "var(--text-muted)" }}>
              <AlertTriangle className="w-3.5 h-3.5 inline mr-2" />
              Key Risks
            </h2>
            <div className="space-y-2">
              {playbook.risks.map((r) => (
                <div
                  key={r.risk}
                  className="rounded-xl p-4"
                  style={{ background: "var(--surface-card)", border: "1px solid var(--surface-border)" }}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <RiskBadge likelihood={r.likelihood} />
                    <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{r.risk}</span>
                  </div>
                  <p className="text-xs" style={{ color: "var(--text-secondary)" }}>{r.mitigation}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Quick actions */}
          <section>
            <h2 className="text-sm font-bold uppercase tracking-wider mb-4" style={{ color: "var(--text-muted)" }}>Quick Actions</h2>
            <div className="flex gap-3">
              <Link
                href={`/projects/new`}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
                style={{ background: "var(--brand-gradient)" }}
              >
                <DollarSign className="w-4 h-4" /> Start Project
              </Link>
              <Link
                href={`/ai?mode=architect&prefill=Design the architecture for a ${playbook.label} project`}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
                style={{ background: "var(--surface-elevated)", color: "var(--text-secondary)", border: "1px solid var(--surface-border)" }}
              >
                <Brain className="w-4 h-4" /> Ask Architect AI
              </Link>
              <Link
                href={`/ai?mode=estimator&prefill=Estimate a ${playbook.label} project`}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
                style={{ background: "var(--surface-elevated)", color: "var(--text-secondary)", border: "1px solid var(--surface-border)" }}
              >
                <Clock className="w-4 h-4" /> Estimate It
              </Link>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
