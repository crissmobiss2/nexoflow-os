"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/trpc/client";
import { ArrowLeft, ArrowRight, Loader2, Zap } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

const PROJECT_TYPES = [
  { value: "website", label: "Website" },
  { value: "web_app", label: "Web App" },
  { value: "mobile_app", label: "Mobile App" },
  { value: "desktop_app", label: "Desktop App" },
  { value: "saas", label: "SaaS Product" },
  { value: "marketplace", label: "Marketplace" },
  { value: "internal_tool", label: "Internal Tool" },
  { value: "ai_product", label: "AI Product" },
  { value: "ecommerce", label: "eCommerce" },
  { value: "portal", label: "Portal" },
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
        className="flex items-center gap-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] mb-6"
      >
        <ArrowLeft className="w-4 h-4" /> Back to projects
      </Link>

      <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-1">New Project</h1>
      <p className="text-sm text-[var(--text-secondary)] mb-8">
        Fill in the client brief — NexoFlow OS will score, scope, and architect it.
      </p>

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-8">
        {[1, 2].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={cn(
                "w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-colors",
                step >= s ? "bg-[var(--brand-primary)] text-white" : "bg-[var(--surface-border)] text-[var(--text-muted)]",
              )}
            >
              {s}
            </div>
            <span className={cn("text-sm font-medium", step >= s ? "text-[var(--text-primary)]" : "text-[var(--text-muted)]")}>
              {s === 1 ? "Project Info" : "Client Brief"}
            </span>
            {s < 2 && <div className="w-10 h-px bg-[var(--surface-border)] mx-1" />}
          </div>
        ))}
      </div>

      <form onSubmit={(e) => void handleSubmit(e)}>
        <div className="bg-white rounded-xl border border-[var(--surface-border)] p-6 space-y-5">
          {step === 1 && (
            <>
              <Field label="Project Name" required>
                <input
                  type="text"
                  value={form.name}
                  onChange={set("name")}
                  placeholder="Acme Client Portal"
                  required
                  className="nf-input"
                />
              </Field>

              <Field label="Project Type" required>
                <select value={form.projectType} onChange={set("projectType")} required className="nf-input">
                  <option value="">Select type...</option>
                  {PROJECT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
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
              <Field label="Additional Context">
                <textarea
                  value={form.additionalContext}
                  onChange={set("additionalContext")}
                  placeholder="Competitors, unique requirements, why now..."
                  rows={3}
                  className="nf-input resize-none"
                />
              </Field>
            </>
          )}
        </div>

        <div className="flex justify-between mt-6">
          {step === 2 ? (
            <button type="button" onClick={() => setStep(1)} className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
          ) : <div />}

          {step === 1 ? (
            <button
              type="button"
              onClick={() => setStep(2)}
              disabled={!step1Valid}
              className="flex items-center gap-2 px-5 py-2.5 bg-[var(--brand-primary)] text-white rounded-lg text-sm font-medium hover:bg-[var(--brand-primary-hover)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Continue <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={isLoading}
              className="flex items-center gap-2 px-5 py-2.5 bg-[var(--brand-primary)] text-white rounded-lg text-sm font-medium hover:bg-[var(--brand-primary-hover)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? (
                <><Loader2 className="w-4 h-4 animate-spin" />{createProject.isPending ? "Creating..." : "Scoring..."}</>
              ) : (
                <><Zap className="w-4 h-4" /> Submit Brief</>
              )}
            </button>
          )}
        </div>
      </form>

      <style jsx global>{`
        .nf-input {
          width: 100%;
          padding: 0.5rem 0.75rem;
          border: 1px solid var(--surface-border);
          border-radius: 8px;
          font-size: 0.875rem;
          background: var(--surface-bg);
          color: var(--text-primary);
          outline: none;
          transition: border-color 0.15s, background 0.15s;
        }
        .nf-input:focus {
          border-color: var(--brand-primary);
          background: white;
          box-shadow: 0 0 0 3px hsl(220 90% 56% / 0.1);
        }
        select.nf-input { cursor: pointer; }
      `}</style>
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
      <label className="flex items-baseline gap-1 text-sm font-medium text-[var(--text-primary)]">
        {label}
        {required && <span className="text-[var(--status-error)]">*</span>}
        {hint && <span className="font-normal text-[var(--text-muted)] text-xs ml-1">{hint}</span>}
      </label>
      {children}
    </div>
  );
}
