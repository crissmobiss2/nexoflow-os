"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/trpc/client";
import { ArrowLeft, ArrowRight, Check, Loader2, Plus, Trash2, GripVertical, Globe, Smartphone, Monitor, Box, ShoppingBag, Wrench, Brain, Store, LayoutDashboard, User, LayoutTemplate, ChevronRight } from "lucide-react";
import Link from "next/link";

const PROJECT_TYPES = [
  { value: "website", label: "Website", desc: "Marketing, portfolio, landing pages", icon: Globe },
  { value: "web_app", label: "Web App", desc: "Browser-based applications", icon: LayoutDashboard },
  { value: "mobile_app", label: "Mobile App", desc: "iOS & Android with Expo", icon: Smartphone },
  { value: "desktop_app", label: "Desktop App", desc: "Windows, Mac & Linux with Tauri", icon: Monitor },
  { value: "saas", label: "SaaS Product", desc: "Multi-tenant subscription software", icon: Box },
  { value: "marketplace", label: "Marketplace", desc: "Two-sided platform or exchange", icon: Store },
  { value: "internal_tool", label: "Internal Tool", desc: "Ops, admin & workflow automation", icon: Wrench },
  { value: "ai_product", label: "AI Product", desc: "LLM-powered features or products", icon: Brain },
  { value: "ecommerce", label: "eCommerce", desc: "Online store or D2C platform", icon: ShoppingBag },
  { value: "portal", label: "Portal", desc: "Client or employee portal", icon: User },
] as const;

type ProjectType = (typeof PROJECT_TYPES)[number]["value"];

type Phase = {
  key: string;
  phaseName: string;
  phaseOrder: number;
  description: string;
};

let phaseKeyCounter = 0;
function newPhase(order: number): Phase {
  return { key: `phase_${phaseKeyCounter++}`, phaseName: "", phaseOrder: order, description: "" };
}

export default function NewTemplatePage() {
  const router = useRouter();
  const createTemplate = api.templates.create.useMutation();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [projectType, setProjectType] = useState<ProjectType | "">("");
  const [briefTemplate, setBriefTemplate] = useState("");
  const [phases, setPhases] = useState<Phase[]>([newPhase(0), newPhase(1), newPhase(2), newPhase(3), newPhase(4)]);
  const [step, setStep] = useState<1 | 2>(1);

  function updatePhase(key: string, field: keyof Phase, value: string | number) {
    setPhases((prev) => prev.map((p) => (p.key === key ? { ...p, [field]: value } : p)));
  }

  function removePhase(key: string) {
    setPhases((prev) => {
      const filtered = prev.filter((p) => p.key !== key);
      return filtered.map((p, i) => ({ ...p, phaseOrder: i }));
    });
  }

  function addPhase() {
    setPhases((prev) => [...prev, newPhase(prev.length)]);
  }

  async function handleCreate() {
    if (!name.trim() || !projectType) return;

    const result = await createTemplate.mutateAsync({
      name: name.trim(),
      description: description || undefined,
      projectType: projectType as ProjectType,
      defaultBriefTemplate: briefTemplate || undefined,
      phases: phases
        .filter((p) => p.phaseName.trim())
        .map((p) => ({
          phaseName: p.phaseName.trim(),
          phaseOrder: p.phaseOrder,
          description: p.description || undefined,
        })),
    });

    router.push(`/templates`);
  }

  const canContinue = name.trim() && projectType;
  const canSubmit = name.trim() && projectType;

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <Link
        href="/templates"
        className="inline-flex items-center gap-1.5 text-sm mb-8 transition-opacity hover:opacity-70"
        style={{ color: "var(--text-secondary)" }}
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Back to templates
      </Link>

      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-1" style={{ color: "var(--text-primary)" }}>New Template</h1>
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          Define a reusable project template with preset phases and default brief content.
        </p>
      </div>

      {/* Step indicators */}
      <div className="flex items-center gap-2 mb-8">
        {[
          { n: 1 as const, label: "Template Details" },
          { n: 2 as const, label: "Phases & Brief" },
        ].map(({ n, label }, i) => {
          const done = step > n;
          const active = step === n;
          return (
            <div key={n} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => done && setStep(n)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer"
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
              {i < 1 && (
                <ChevronRight className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--surface-border)" }} />
              )}
            </div>
          );
        })}
      </div>

      <div className="space-y-6">
        {/* STEP 1: Basic Info */}
        {step === 1 && (
          <div
            className="rounded-2xl p-6 space-y-5"
            style={{ background: "var(--surface-card)", border: "1px solid var(--surface-border)" }}
          >
            {/* Name */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>Template Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. SaaS MVP, Mobile App Starter"
                className="nf-input"
                autoFocus
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Briefly describe what this template is for…"
                rows={3}
                className="nf-input resize-none"
              />
            </div>

            {/* Project Type */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>Project Type *</label>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {PROJECT_TYPES.map(({ value, label, desc, icon: Icon }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setProjectType(value as ProjectType)}
                    className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl border text-left transition-all"
                    style={
                      projectType === value
                        ? { borderColor: "var(--brand-primary)", background: "hsl(220 90% 62% / 0.1)" }
                        : { borderColor: "var(--surface-border)", background: "var(--surface-elevated)" }
                    }
                  >
                    <Icon
                      className="w-4 h-4 shrink-0 mt-0.5"
                      style={{ color: projectType === value ? "var(--brand-primary)" : "var(--text-muted)" }}
                    />
                    <div>
                      <div className="text-xs font-semibold" style={{ color: projectType === value ? "var(--brand-primary)" : "var(--text-primary)" }}>
                        {label}
                      </div>
                      <div className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>{desc}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: Phases & Brief */}
        {step === 2 && (
          <div className="space-y-4">
            {/* Default Brief Template */}
            <div
              className="rounded-2xl p-6"
              style={{ background: "var(--surface-card)", border: "1px solid var(--surface-border)" }}
            >
              <h3 className="text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Default Brief Template</h3>
              <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>
                Optional. Pre-fill the project brief when using this template. Supports markdown.
              </p>
              <textarea
                value={briefTemplate}
                onChange={(e) => setBriefTemplate(e.target.value)}
                placeholder="e.g. Target users are small business owners who need to...&#10;Core features include user management, billing, and reporting.&#10;Must integrate with Stripe and SendGrid."
                rows={5}
                className="nf-input resize-none"
              />
            </div>

            {/* Phases */}
            <div
              className="rounded-2xl p-6"
              style={{ background: "var(--surface-card)", border: "1px solid var(--surface-border)" }}
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Project Phases</h3>
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                    Define the phases that will be auto-created when using this template
                  </p>
                </div>
                <button
                  onClick={addPhase}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                  style={{ background: "hsl(220 90% 62% / 0.1)", color: "var(--brand-primary)" }}
                >
                  <Plus className="w-3 h-3" /> Add Phase
                </button>
              </div>

              <div className="space-y-2">
                {phases.map((phase, idx) => (
                  <div
                    key={phase.key}
                    className="rounded-xl p-4"
                    style={{ background: "var(--surface-elevated)", border: "1px solid var(--surface-border)" }}
                  >
                    <div className="flex items-center gap-3">
                      <GripVertical className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-muted)" }} />
                      <span className="text-xs font-mono w-5" style={{ color: "var(--text-muted)" }}>#{idx + 1}</span>
                      <input
                        type="text"
                        value={phase.phaseName}
                        onChange={(e) => updatePhase(phase.key, "phaseName", e.target.value)}
                        placeholder="e.g. Discovery, Architecture, Build…"
                        className="nf-input flex-1"
                      />
                      <button
                        onClick={() => removePhase(phase.key)}
                        className="p-1.5 rounded-lg transition-colors hover:bg-red-500/10"
                        disabled={phases.length <= 1}
                      >
                        <Trash2 className="w-3.5 h-3.5" style={{ color: phases.length > 1 ? "var(--status-error)" : "var(--text-muted)" }} />
                      </button>
                    </div>
                    <input
                      type="text"
                      value={phase.description}
                      onChange={(e) => updatePhase(phase.key, "description", e.target.value)}
                      placeholder="Optional description of this phase"
                      className="nf-input mt-2 text-xs"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep(1)}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-medium transition-opacity hover:opacity-80"
              style={{ color: "var(--text-secondary)", background: "var(--surface-elevated)", border: "1px solid var(--surface-border)" }}
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back
            </button>
          ) : <div />}

          {step < 2 ? (
            <button
              type="button"
              onClick={() => setStep(2)}
              disabled={!canContinue}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed"
              style={{ background: "var(--brand-gradient)" }}
            >
              Continue <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleCreate}
              disabled={!canSubmit || createTemplate.isPending}
              className="flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: "var(--brand-gradient)" }}
            >
              {createTemplate.isPending ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Creating…</>
              ) : (
                <><LayoutTemplate className="w-3.5 h-3.5" /> Create Template</>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
