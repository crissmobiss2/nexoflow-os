"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/trpc/client";
import {
  ArrowLeft, ArrowRight, Check, Loader2, Zap, Plus,
  User, Globe, Smartphone, Monitor, Box, ShoppingBag,
  Wrench, Brain, Store, LayoutDashboard, Search, ChevronRight,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

const PROJECT_TYPES = [
  { value: "website",       label: "Website",       desc: "Marketing, portfolio, landing pages",        icon: Globe },
  { value: "web_app",       label: "Web App",        desc: "Browser-based applications & dashboards",   icon: LayoutDashboard },
  { value: "mobile_app",    label: "Mobile App",     desc: "iOS & Android with React Native + Expo",     icon: Smartphone },
  { value: "desktop_app",   label: "Desktop App",    desc: "Windows, Mac & Linux with Tauri",            icon: Monitor },
  { value: "saas",          label: "SaaS Product",   desc: "Multi-tenant subscription software",         icon: Box },
  { value: "marketplace",   label: "Marketplace",    desc: "Two-sided platform or exchange",             icon: Store },
  { value: "internal_tool", label: "Internal Tool",  desc: "Ops, admin & workflow automation",           icon: Wrench },
  { value: "ai_product",    label: "AI Product",     desc: "LLM-powered features or products",           icon: Brain },
  { value: "ecommerce",     label: "eCommerce",      desc: "Online store or D2C platform",               icon: ShoppingBag },
  { value: "portal",        label: "Portal",         desc: "Client or employee portal",                  icon: User },
] as const;

const BUDGET_RANGES = [
  "Under £5K", "£5K–£10K", "£10K–£20K", "£20K–£40K",
  "£40K–£80K", "£80K–£150K", "£150K+",
];

type ProjectType = (typeof PROJECT_TYPES)[number]["value"];
type Step = 1 | 2 | 3;

const STEPS = [
  { n: 1 as Step, label: "Select Client" },
  { n: 2 as Step, label: "Project Type" },
  { n: 3 as Step, label: "Brief" },
];

function NewProjectInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedClientId = searchParams.get("clientId");

  const { data: allClients = [] } = api.clients.list.useQuery();
  const createProject = api.projects.create.useMutation();
  const scoreProject = api.projects.score.useMutation();

  const [step, setStep] = useState<Step>(preselectedClientId ? 2 : 1);
  const [clientSearch, setClientSearch] = useState("");
  const [selectedClientId, setSelectedClientId] = useState<string>(preselectedClientId ?? "");
  const [projectType, setProjectType] = useState<ProjectType | "">("");
  const [form, setForm] = useState({
    name: "", industry: "", budgetRange: "", timelineWeeks: "",
    targetUser: "", coreJobToBeDone: "", existingTech: "",
    keyIntegrations: "", constraints: "", additionalContext: "",
  });

  const set = (key: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((p) => ({ ...p, [key]: e.target.value }));

  const selectedClient = allClients.find((c) => c.id === selectedClientId);

  const filteredClients = clientSearch
    ? allClients.filter((c) =>
        c.name.toLowerCase().includes(clientSearch.toLowerCase()) ||
        c.company?.toLowerCase().includes(clientSearch.toLowerCase())
      )
    : allClients;

  const isLoading = createProject.isPending || scoreProject.isPending;

  async function submit() {
    if (!projectType) return;
    const project = await createProject.mutateAsync({
      name: form.name || `${selectedClient?.company ?? selectedClient?.name ?? "New"} ${PROJECT_TYPES.find((t) => t.value === projectType)?.label ?? "Project"}`,
      projectType: projectType as ProjectType,
      clientId: selectedClientId || undefined,
      industry: form.industry || selectedClient?.industry || undefined,
      budgetRange: form.budgetRange || selectedClient?.typicalBudget || undefined,
      timelineWeeks: form.timelineWeeks ? parseInt(form.timelineWeeks) : undefined,
      brief: {
        targetUser: form.targetUser || selectedClient?.targetCustomers || undefined,
        coreJobToBeDone: form.coreJobToBeDone || selectedClient?.currentChallenges || undefined,
        existingTech: form.existingTech || selectedClient?.existingTech || undefined,
        keyIntegrations: form.keyIntegrations || undefined,
        constraints: form.constraints || undefined,
        additionalContext: form.additionalContext || undefined,
      },
    });
    await scoreProject.mutateAsync({ projectId: project.id });
    router.push(`/projects/${project.id}`);
  }

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <Link
        href="/projects"
        className="inline-flex items-center gap-1.5 text-sm mb-8 transition-opacity hover:opacity-70"
        style={{ color: "var(--text-secondary)" }}
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Back to projects
      </Link>

      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-1" style={{ color: "var(--text-primary)" }}>New Project</h1>
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          Link to a client, pick the category, fill in the brief — Claude does the rest.
        </p>
      </div>

      {/* Step indicators */}
      <div className="flex items-center gap-2 mb-8">
        {STEPS.map(({ n, label }, i) => {
          const done = step > n;
          const active = step === n;
          return (
            <div key={n} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => done && setStep(n)}
                className={cn("flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all", done ? "cursor-pointer hover:opacity-80" : "cursor-default")}
                style={
                  active
                    ? { background: "var(--brand-primary)", color: "white" }
                    : done
                    ? { background: "hsl(142 68% 52% / 0.15)", color: "hsl(142, 68%, 52%)" }
                    : { background: "var(--surface-elevated)", color: "var(--text-muted)" }
                }
              >
                {done ? <Check className="w-3 h-3" /> : <span>{n}</span>}
                {label}
              </button>
              {i < STEPS.length - 1 && (
                <ChevronRight className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--surface-border)" }} />
              )}
            </div>
          );
        })}
      </div>

      <div
        className="rounded-2xl p-6"
        style={{ background: "var(--surface-card)", border: "1px solid var(--surface-border)" }}
      >
        {/* STEP 1: Select Client */}
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
              Which client is this for?
            </h2>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
              <input
                type="text"
                placeholder="Search clients…"
                value={clientSearch}
                onChange={(e) => setClientSearch(e.target.value)}
                className="nf-input pl-9"
                autoFocus
              />
            </div>

            {filteredClients.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>No clients found.</p>
              </div>
            ) : (
              <div className="space-y-1.5 max-h-80 overflow-auto">
                {filteredClients.map((client) => (
                  <button
                    key={client.id}
                    type="button"
                    onClick={() => { setSelectedClientId(client.id); }}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all"
                    style={
                      selectedClientId === client.id
                        ? { background: "hsl(220 90% 62% / 0.1)", border: "1px solid var(--brand-primary)" }
                        : { background: "var(--surface-elevated)", border: "1px solid transparent" }
                    }
                  >
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0"
                      style={{ background: "var(--brand-gradient)", color: "white" }}
                    >
                      {client.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{client.name}</div>
                      {client.company && (
                        <div className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
                          {client.company}{client.industry ? ` · ${client.industry}` : ""}
                        </div>
                      )}
                    </div>
                    {selectedClientId === client.id && (
                      <Check className="w-4 h-4 shrink-0" style={{ color: "var(--brand-primary)" }} />
                    )}
                  </button>
                ))}
              </div>
            )}

            <div
              className="flex items-center gap-3 pt-2"
              style={{ borderTop: "1px solid var(--surface-border)" }}
            >
              <Link
                href="/clients/new"
                className="flex items-center gap-1.5 text-xs font-medium transition-opacity hover:opacity-70"
                style={{ color: "var(--brand-primary)" }}
              >
                <Plus className="w-3 h-3" /> Onboard new client first
              </Link>
              {allClients.length > 0 && (
                <button
                  type="button"
                  onClick={() => { setSelectedClientId(""); setStep(2); }}
                  className="ml-auto text-xs transition-opacity hover:opacity-70"
                  style={{ color: "var(--text-muted)" }}
                >
                  Skip — no client
                </button>
              )}
            </div>
          </div>
        )}

        {/* STEP 2: Project Type */}
        {step === 2 && (
          <div className="space-y-4">
            {selectedClient && (
              <div
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl mb-2"
                style={{ background: "hsl(220 90% 62% / 0.08)", border: "1px solid hsl(220 90% 62% / 0.2)" }}
              >
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0"
                  style={{ background: "var(--brand-gradient)", color: "white" }}
                >
                  {selectedClient.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="text-xs font-medium" style={{ color: "var(--brand-primary)" }}>{selectedClient.name}</div>
                  {selectedClient.company && (
                    <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>{selectedClient.company}</div>
                  )}
                </div>
              </div>
            )}

            <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>What are we building?</h2>
            <div className="grid grid-cols-2 gap-2">
              {PROJECT_TYPES.map(({ value, label, desc, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setProjectType(value)}
                  className="flex items-start gap-3 px-3 py-3 rounded-xl border text-left transition-all"
                  style={
                    projectType === value
                      ? { borderColor: "var(--brand-primary)", background: "hsl(220 90% 62% / 0.1)", boxShadow: "0 0 0 1px hsl(220 90% 62% / 0.3)" }
                      : { borderColor: "var(--surface-border)", background: "var(--surface-elevated)" }
                  }
                >
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                    style={{
                      background: projectType === value ? "hsl(220 90% 62% / 0.2)" : "var(--surface-card)",
                    }}
                  >
                    <Icon
                      className="w-3.5 h-3.5"
                      style={{ color: projectType === value ? "var(--brand-primary)" : "var(--text-muted)" }}
                    />
                  </div>
                  <div>
                    <div className="text-xs font-semibold" style={{ color: projectType === value ? "var(--brand-primary)" : "var(--text-primary)" }}>
                      {label}
                    </div>
                    <div className="text-[11px] mt-0.5 leading-tight" style={{ color: "var(--text-muted)" }}>{desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* STEP 3: Brief */}
        {step === 3 && (
          <div className="space-y-5">
            {selectedClient && (
              <div
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
                style={{ background: "hsl(220 90% 62% / 0.08)", color: "var(--brand-primary)" }}
              >
                <Check className="w-3 h-3" />
                {selectedClient.name} · {PROJECT_TYPES.find((t) => t.value === projectType)?.label}
              </div>
            )}

            <Field label="Project Name" hint="Leave blank to auto-generate">
              <input
                autoFocus
                type="text"
                value={form.name}
                onChange={set("name")}
                placeholder={`${selectedClient?.company ?? selectedClient?.name ?? "New"} ${PROJECT_TYPES.find((t) => t.value === projectType)?.label ?? "Project"}`}
                className="nf-input"
              />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Industry / Niche">
                <input
                  type="text"
                  value={form.industry}
                  onChange={set("industry")}
                  placeholder={selectedClient?.industry ?? "e.g. Legal, Healthcare"}
                  className="nf-input"
                />
              </Field>
              <Field label="Budget Range">
                <select value={form.budgetRange} onChange={set("budgetRange")} className="nf-input">
                  <option value="">{selectedClient?.typicalBudget ? `Client default: ${selectedClient.typicalBudget}` : "Select range…"}</option>
                  {BUDGET_RANGES.map((b) => <option key={b}>{b}</option>)}
                </select>
              </Field>
            </div>

            <Field label="Target User" hint="Who specifically is this for?">
              <input
                type="text"
                value={form.targetUser}
                onChange={set("targetUser")}
                placeholder={selectedClient?.targetCustomers ?? "e.g. Operations managers at construction firms"}
                className="nf-input"
              />
            </Field>

            <Field label="Core Job To Be Done" hint="What problem does this solve?">
              <textarea
                value={form.coreJobToBeDone}
                onChange={set("coreJobToBeDone")}
                rows={3}
                placeholder={selectedClient?.currentChallenges ?? "e.g. Track site inspections and auto-generate compliance reports without manual data entry"}
                className="nf-input resize-none"
              />
            </Field>

            <Field label="Existing Tech">
              <input
                type="text"
                value={form.existingTech}
                onChange={set("existingTech")}
                placeholder={selectedClient?.existingTech ?? "e.g. Microsoft 365, Salesforce, SQL Server"}
                className="nf-input"
              />
            </Field>

            <Field label="Key Integrations Required">
              <input
                type="text"
                value={form.keyIntegrations}
                onChange={set("keyIntegrations")}
                placeholder="e.g. Stripe, HubSpot, Xero, Google Maps"
                className="nf-input"
              />
            </Field>

            <Field label="Constraints">
              <input
                type="text"
                value={form.constraints}
                onChange={set("constraints")}
                placeholder="e.g. GDPR required, must work offline, iOS only"
                className="nf-input"
              />
            </Field>

            <Field label="Additional Context" hint="Anything Claude should know?">
              <textarea
                value={form.additionalContext}
                onChange={set("additionalContext")}
                rows={2}
                placeholder="Competitors, why now, unique requirements, key risks…"
                className="nf-input resize-none"
              />
            </Field>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between mt-5">
        {step > 1 ? (
          <button
            type="button"
            onClick={() => setStep((s) => (s - 1) as Step)}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-medium transition-opacity hover:opacity-80"
            style={{ color: "var(--text-secondary)", background: "var(--surface-elevated)", border: "1px solid var(--surface-border)" }}
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back
          </button>
        ) : <div />}

        {step < 3 ? (
          <button
            type="button"
            onClick={() => setStep((s) => (s + 1) as Step)}
            disabled={step === 2 && !projectType}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed"
            style={{ background: "var(--brand-gradient)" }}
          >
            Continue <ArrowRight className="w-3.5 h-3.5" />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void submit()}
            disabled={isLoading}
            className="flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: "var(--brand-gradient)" }}
          >
            {isLoading ? (
              <><Loader2 className="w-3.5 h-3.5 animate-spin" />{createProject.isPending ? "Creating…" : "Scoring brief…"}</>
            ) : (
              <><Zap className="w-3.5 h-3.5" /> Submit &amp; Score</>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline gap-1.5">
        <label className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{label}</label>
        {hint && <span className="text-xs" style={{ color: "var(--text-muted)" }}>{hint}</span>}
      </div>
      {children}
    </div>
  );
}

export default function NewProjectPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-5 h-5 animate-spin" style={{ color: "var(--text-muted)" }} />
      </div>
    }>
      <NewProjectInner />
    </Suspense>
  );
}
