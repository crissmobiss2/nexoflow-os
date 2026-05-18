"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/trpc/client";
import { ArrowLeft, ArrowRight, Loader2, Zap, Check } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

const PROJECT_TYPES = [
  { value: "website", label: "Website", description: "Marketing, portfolio, landing pages" },
  { value: "web_app", label: "Web App", description: "Browser-based applications" },
  { value: "mobile_app", label: "Mobile App", description: "iOS & Android with React Native" },
  { value: "desktop_app", label: "Desktop App", description: "Windows, Mac, Linux with Tauri" },
  { value: "saas", label: "SaaS Product", description: "Multi-tenant subscription software" },
  { value: "marketplace", label: "Marketplace", description: "Two-sided platform or exchange" },
  { value: "internal_tool", label: "Internal Tool", description: "Ops, admin, or workflow tools" },
  { value: "ai_product", label: "AI Product", description: "LLM-powered features or products" },
  { value: "ecommerce", label: "eCommerce", description: "Online store or D2C platform" },
  { value: "portal", label: "Portal", description: "Client or employee portal" },
] as const;

const BUDGET_RANGES = [
  "Under £5K", "£5K–£10K", "£10K–£20K", "£20K–£40K",
  "£40K–£80K", "£80K–£150K", "£150K+",
];

type ProjectType = (typeof PROJECT_TYPES)[number]["value"];

export default function NewProjectPage() {
  const router = useRouter();
  const createProject = api.projects.create.useMutation();
  const scoreProject = api.projects.score.useMutation();

  const [step, setStep] = useState<1 | 2>(1);
  const [form, setForm] = useState({
    name: "",
    projectType: "" as ProjectType | "",
    industry: "",
    budgetRange: "",
    timelineWeeks: "",
    targetUser: "",
    coreJobToBeDone: "",
    existingTech: "",
    keyIntegrations: "",
    constraints: "",
    additionalContext: "",
  });

  const set =
    (key: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((prev) => ({ ...prev, [key]: e.target.value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.projectType) return;

    const project = await createProject.mutateAsync({
      name: form.name,
      projectType: form.projectType as ProjectType,
      industry: form.industry || undefined,
      budgetRange: form.budgetRange || undefined,
      timelineWeeks: form.timelineWeeks ? parseInt(form.timelineWeeks) : undefined,
      brief: {
        targetUser: form.targetUser || undefined,
        coreJobToBeDone: form.coreJobToBeDone || undefined,
        existingTech: form.existingTech || undefined,
        keyIntegrations: form.keyIntegrations || undefined,
        constraints: form.constraints || undefined,
        additionalContext: form.additionalContext || undefined,
      },
    });

    await scoreProject.mutateAsync({ projectId: project.id });
    router.push(`/projects/${project.id}`);
  }

  const isLoading = createProject.isPending || scoreProject.isPending;
  const step1Valid = !!form.name && !!form.projectType;

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <Link
        href="/projects"
        className="flex items-center gap-1.5 text-sm mb-7 transition-colors hover:opacity-80"
        style={{ color: "var(--text-secondary)" }}
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Back to projects
      </Link>

      <div className="mb-8">
        <h1 className="text-xl font-bold mb-1" style={{ color: "var(--text-primary)" }}>
          New Project
        </h1>
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          Fill in the client brief — NexoFlow OS will score and scope it automatically.
        </p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-3 mb-8">
        {[
          { n: 1, label: "Project Info" },
          { n: 2, label: "Client Brief" },
        ].map(({ n, label }, i) => (
          <div key={n} className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold transition-all"
                style={
                  step > n
                    ? { background: "var(--status-success)", color: "white" }
                    : step === n
                    ? { background: "var(--brand-primary)", color: "white" }
                    : { background: "var(--surface-elevated)", color: "var(--text-muted)" }
                }
              >
                {step > n ? <Check className="w-3 h-3" /> : n}
              </div>
              <span
                className="text-sm font-medium"
                style={{ color: step >= n ? "var(--text-primary)" : "var(--text-muted)" }}
              >
                {label}
              </span>
            </div>
            {i < 1 && (
              <div className="w-10 h-px" style={{ background: "var(--surface-border)" }} />
            )}
          </div>
        ))}
      </div>

      <form onSubmit={(e) => void handleSubmit(e)}>
        <div
          className="rounded-xl p-6 space-y-5"
          style={{ background: "var(--surface-card)", border: "1px solid var(--surface-border)" }}
        >
          {step === 1 && (
            <>
              <Field label="Project Name" required>
                <input
                  type="text"
                  value={form.name}
                  onChange={set("name")}
                  placeholder="e.g. Acme Client Portal"
                  required
                  className="nf-input"
                />
              </Field>

              <Field label="Project Type" required hint="What are we building?">
                <div className="grid grid-cols-2 gap-2 mt-0.5">
                  {PROJECT_TYPES.map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setForm((p) => ({ ...p, projectType: t.value }))}
                      className="text-left px-3 py-2.5 rounded-lg border transition-all"
                      style={
                        form.projectType === t.value
                          ? {
                              borderColor: "var(--brand-primary)",
                              background: "hsl(220 90% 62% / 0.1)",
                              boxShadow: "0 0 0 1px hsl(220 90% 62% / 0.3)",
                            }
                          : {
                              borderColor: "var(--surface-border)",
                              background: "var(--surface-elevated)",
                            }
                      }
                    >
                      <div
                        className="text-xs font-semibold"
                        style={{ color: form.projectType === t.value ? "var(--brand-primary)" : "var(--text-primary)" }}
                      >
                        {t.label}
                      </div>
                      <div className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                        {t.description}
                      </div>
                    </button>
                  ))}
                </div>
              </Field>

              <Field label="Industry / Niche">
                <input
                  type="text"
                  value={form.industry}
                  onChange={set("industry")}
                  placeholder="e.g. Legal, Construction, Healthcare, Hospitality"
                  className="nf-input"
                />
              </Field>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Budget Range">
                  <select value={form.budgetRange} onChange={set("budgetRange")} className="nf-input">
                    <option value="">Select range...</option>
                    {BUDGET_RANGES.map((b) => <option key={b}>{b}</option>)}
                  </select>
                </Field>
                <Field label="Timeline (weeks)">
                  <input
                    type="number"
                    value={form.timelineWeeks}
                    onChange={set("timelineWeeks")}
                    placeholder="8"
                    min="1"
                    max="104"
                    className="nf-input"
                  />
                </Field>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <Field label="Target User" hint="Who is this for?">
                <input
                  type="text"
                  value={form.targetUser}
                  onChange={set("targetUser")}
                  placeholder="e.g. Operations managers at mid-sized construction firms"
                  className="nf-input"
                />
              </Field>
              <Field label="Core Job To Be Done" hint="What problem does it solve?">
                <textarea
                  value={form.coreJobToBeDone}
                  onChange={set("coreJobToBeDone")}
                  placeholder="e.g. Track site inspections and automatically generate compliance reports without manual data entry"
                  rows={3}
                  className="nf-input resize-none"
                />
              </Field>
              <Field label="Existing Tech" hint="What does the client already have?">
                <input
                  type="text"
                  value={form.existingTech}
                  onChange={set("existingTech")}
                  placeholder="e.g. SQL Server DB, Microsoft 365, Salesforce CRM"
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
                  placeholder="e.g. Must work offline, GDPR required, iOS only"
                  className="nf-input"
                />
              </Field>
              <Field label="Additional Context" hint="Anything else Claude should know?">
                <textarea
                  value={form.additionalContext}
                  onChange={set("additionalContext")}
                  placeholder="Competitors, unique requirements, why now, key risks..."
                  rows={3}
                  className="nf-input resize-none"
                />
              </Field>
            </>
          )}
        </div>

        <div className="flex justify-between mt-5">
          {step === 2 ? (
            <button
              type="button"
              onClick={() => setStep(1)}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition-colors rounded-lg hover:opacity-80"
              style={{ color: "var(--text-secondary)", background: "var(--surface-elevated)", border: "1px solid var(--surface-border)" }}
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back
            </button>
          ) : <div />}

          {step === 1 ? (
            <button
              type="button"
              onClick={() => setStep(2)}
              disabled={!step1Valid}
              className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed"
              style={{ background: "var(--brand-gradient)" }}
            >
              Continue <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={isLoading}
              className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: "var(--brand-gradient)" }}
            >
              {isLoading ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin" />{createProject.isPending ? "Creating..." : "Scoring brief..."}</>
              ) : (
                <><Zap className="w-3.5 h-3.5" /> Submit Brief</>
              )}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

function Field({
  label, hint, required, children,
}: {
  label: string; hint?: string; required?: boolean; children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline gap-1.5">
        <label className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
          {label}
          {required && <span className="ml-0.5" style={{ color: "var(--status-error)" }}>*</span>}
        </label>
        {hint && (
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>{hint}</span>
        )}
      </div>
      {children}
    </div>
  );
}
