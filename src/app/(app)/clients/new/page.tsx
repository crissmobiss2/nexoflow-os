"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/trpc/client";
import {
  ArrowLeft, ArrowRight, Check, Loader2,
  User, Building2, Lightbulb, DollarSign,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

const STEPS = [
  { n: 1, label: "Contact", icon: User },
  { n: 2, label: "Company", icon: Building2 },
  { n: 3, label: "Context", icon: Lightbulb },
  { n: 4, label: "Commercial", icon: DollarSign },
] as const;

const COMPANY_SIZES = ["1–10", "11–50", "51–200", "201–1,000", "1,000+"];
const BUDGET_RANGES = [
  "Under £5K", "£5K–£10K", "£10K–£20K", "£20K–£40K",
  "£40K–£80K", "£80K–£150K", "£150K+",
];
const URGENCY_OPTIONS = [
  { value: "exploring", label: "Exploring", desc: "No fixed timeline, researching options" },
  { value: "planning", label: "Planning", desc: "Targeting a start within 1–3 months" },
  { value: "urgent", label: "Urgent", desc: "Ready to go, need to start ASAP" },
];

const initialForm = {
  name: "", email: "", phone: "", company: "", website: "",
  industry: "", companySize: "", region: "",
  businessDescription: "", targetCustomers: "",
  currentChallenges: "", existingTech: "",
  typicalBudget: "", urgency: "", decisionMakerRole: "", notes: "",
};

export default function NewClientPage() {
  const router = useRouter();
  const createClient = api.clients.create.useMutation({
    onSuccess: (client) => {
      if (client) router.push(`/clients/${client.id}`);
    },
  });

  const [step, setStep] = useState(1);
  const [form, setForm] = useState(initialForm);

  const set = (key: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((p) => ({ ...p, [key]: e.target.value }));

  const setVal = (key: keyof typeof form, val: string) =>
    setForm((p) => ({ ...p, [key]: val }));

  const step1Valid = !!form.name;
  const step2Valid = true;
  const step3Valid = !!form.businessDescription;
  const canAdvance = [step1Valid, step2Valid, step3Valid, true][step - 1];

  async function submit() {
    await createClient.mutateAsync({
      ...form,
      email: form.email || undefined,
    });
  }

  return (
    <div className="min-h-screen p-8" style={{ background: "var(--surface-bg)" }}>
      <div className="max-w-2xl mx-auto">
        <Link
          href="/clients"
          className="inline-flex items-center gap-1.5 text-sm mb-8 transition-opacity hover:opacity-70"
          style={{ color: "var(--text-secondary)" }}
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to clients
        </Link>

        <div className="mb-8">
          <h1 className="text-2xl font-bold mb-1" style={{ color: "var(--text-primary)" }}>
            Onboard New Client
          </h1>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            Capture the full client profile — this context flows into every brief, scope, and architecture document.
          </p>
        </div>

        {/* Step indicators */}
        <div className="flex items-center gap-2 mb-8">
          {STEPS.map(({ n, label, icon: Icon }, i) => {
            const done = step > n;
            const active = step === n;
            return (
              <div key={n} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => done && setStep(n)}
                  className={cn("flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all", done ? "cursor-pointer" : "cursor-default")}
                  style={
                    active
                      ? { background: "var(--brand-primary)", color: "white" }
                      : done
                      ? { background: "hsl(142 68% 52% / 0.15)", color: "hsl(142, 68%, 52%)" }
                      : { background: "var(--surface-elevated)", color: "var(--text-muted)" }
                  }
                >
                  {done ? <Check className="w-3 h-3" /> : <Icon className="w-3 h-3" />}
                  {label}
                </button>
                {i < STEPS.length - 1 && (
                  <div className="w-6 h-px" style={{ background: "var(--surface-border)" }} />
                )}
              </div>
            );
          })}
        </div>

        {/* Form card */}
        <div
          className="rounded-2xl p-8 space-y-6"
          style={{ background: "var(--surface-card)", border: "1px solid var(--surface-border)" }}
        >
          {step === 1 && (
            <>
              <SectionTitle icon={User} title="Contact Details" />
              <div className="grid grid-cols-2 gap-5">
                <Field label="Full Name" required span>
                  <input autoFocus type="text" value={form.name} onChange={set("name")} placeholder="Alex Johnson" required className="nf-input" />
                </Field>
                <Field label="Email Address">
                  <input type="email" value={form.email} onChange={set("email")} placeholder="alex@company.com" className="nf-input" />
                </Field>
                <Field label="Phone Number">
                  <input type="tel" value={form.phone} onChange={set("phone")} placeholder="+44 7700 900000" className="nf-input" />
                </Field>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <SectionTitle icon={Building2} title="Company Information" />
              <div className="grid grid-cols-2 gap-5">
                <Field label="Company Name" span>
                  <input autoFocus type="text" value={form.company} onChange={set("company")} placeholder="Acme Corp Ltd" className="nf-input" />
                </Field>
                <Field label="Website">
                  <input type="url" value={form.website} onChange={set("website")} placeholder="https://acme.com" className="nf-input" />
                </Field>
                <Field label="Industry / Niche">
                  <input type="text" value={form.industry} onChange={set("industry")} placeholder="e.g. Legal, Construction, SaaS" className="nf-input" />
                </Field>
                <Field label="Company Size">
                  <select value={form.companySize} onChange={set("companySize")} className="nf-input">
                    <option value="">Select size…</option>
                    {COMPANY_SIZES.map((s) => <option key={s} value={s}>{s} employees</option>)}
                  </select>
                </Field>
                <Field label="Region / Country">
                  <input type="text" value={form.region} onChange={set("region")} placeholder="e.g. UK, Australia, US" className="nf-input" />
                </Field>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <SectionTitle icon={Lightbulb} title="Business Context" />
              <Field label="What does their business do?" required hint="Be specific — this feeds every AI prompt">
                <textarea
                  autoFocus
                  value={form.businessDescription}
                  onChange={set("businessDescription")}
                  rows={3}
                  placeholder="e.g. They operate a chain of 12 dental practices across the UK and need to modernise their booking and patient management system."
                  className="nf-input resize-none"
                />
              </Field>
              <Field label="Who are their customers?">
                <textarea
                  value={form.targetCustomers}
                  onChange={set("targetCustomers")}
                  rows={2}
                  placeholder="e.g. NHS patients and private patients aged 18–65 across the South East"
                  className="nf-input resize-none"
                />
              </Field>
              <Field label="Current challenges / pain points" hint="What are we solving?">
                <textarea
                  value={form.currentChallenges}
                  onChange={set("currentChallenges")}
                  rows={3}
                  placeholder="e.g. Manual booking via phone, no patient portal, staff spending 2+ hours/day on admin, no visibility into utilisation across sites"
                  className="nf-input resize-none"
                />
              </Field>
              <Field label="Existing tech / tools they use">
                <input
                  type="text"
                  value={form.existingTech}
                  onChange={set("existingTech")}
                  placeholder="e.g. Microsoft 365, Sage accounting, Dentally PMS, no CRM"
                  className="nf-input"
                />
              </Field>
            </>
          )}

          {step === 4 && (
            <>
              <SectionTitle icon={DollarSign} title="Commercial Profile" />
              <Field label="Typical budget expectation">
                <div className="grid grid-cols-2 gap-2 mt-0.5">
                  {BUDGET_RANGES.map((b) => (
                    <button
                      key={b}
                      type="button"
                      onClick={() => setVal("typicalBudget", b)}
                      className="px-3 py-2 rounded-lg border text-xs font-medium text-left transition-all"
                      style={
                        form.typicalBudget === b
                          ? { borderColor: "var(--brand-primary)", background: "hsl(220 90% 62% / 0.1)", color: "var(--brand-primary)" }
                          : { borderColor: "var(--surface-border)", background: "var(--surface-elevated)", color: "var(--text-secondary)" }
                      }
                    >
                      {b}
                    </button>
                  ))}
                </div>
              </Field>

              <Field label="Urgency">
                <div className="space-y-2 mt-0.5">
                  {URGENCY_OPTIONS.map((u) => (
                    <button
                      key={u.value}
                      type="button"
                      onClick={() => setVal("urgency", u.value)}
                      className="w-full text-left px-4 py-3 rounded-lg border transition-all"
                      style={
                        form.urgency === u.value
                          ? { borderColor: "var(--brand-primary)", background: "hsl(220 90% 62% / 0.1)" }
                          : { borderColor: "var(--surface-border)", background: "var(--surface-elevated)" }
                      }
                    >
                      <div className="text-sm font-medium" style={{ color: form.urgency === u.value ? "var(--brand-primary)" : "var(--text-primary)" }}>
                        {u.label}
                      </div>
                      <div className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{u.desc}</div>
                    </button>
                  ))}
                </div>
              </Field>

              <div className="grid grid-cols-2 gap-5">
                <Field label="Decision maker's role">
                  <input
                    type="text"
                    value={form.decisionMakerRole}
                    onChange={set("decisionMakerRole")}
                    placeholder="e.g. CEO, Head of IT, Operations Director"
                    className="nf-input"
                  />
                </Field>
              </div>

              <Field label="Internal notes" hint="Won't appear in client-facing docs">
                <textarea
                  value={form.notes}
                  onChange={set("notes")}
                  rows={2}
                  placeholder="How they found us, warm/cold lead, any sensitivities…"
                  className="nf-input resize-none"
                />
              </Field>
            </>
          )}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-5">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep((s) => (s - 1) as typeof step)}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-medium transition-opacity hover:opacity-80"
              style={{ color: "var(--text-secondary)", background: "var(--surface-elevated)", border: "1px solid var(--surface-border)" }}
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back
            </button>
          ) : <div />}

          {step < 4 ? (
            <button
              type="button"
              onClick={() => setStep((s) => (s + 1) as typeof step)}
              disabled={!canAdvance}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed"
              style={{ background: "var(--brand-gradient)" }}
            >
              Continue <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void submit()}
              disabled={createClient.isPending}
              className="flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: "var(--brand-gradient)" }}
            >
              {createClient.isPending ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…</>
              ) : (
                <><Check className="w-3.5 h-3.5" /> Save Client</>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="flex items-center gap-2.5 pb-1" style={{ borderBottom: "1px solid var(--surface-border)" }}>
      <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "hsl(220 90% 62% / 0.12)" }}>
        <Icon className="w-3.5 h-3.5" style={{ color: "var(--brand-primary)" }} />
      </div>
      <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{title}</h2>
    </div>
  );
}

function Field({
  label, hint, required, span, children,
}: {
  label: string; hint?: string; required?: boolean; span?: boolean; children: React.ReactNode;
}) {
  return (
    <div className={cn("space-y-1.5", span && "col-span-2")}>
      <div className="flex items-baseline gap-1.5">
        <label className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
          {label}
          {required && <span className="ml-0.5" style={{ color: "var(--status-error)" }}>*</span>}
        </label>
        {hint && <span className="text-xs" style={{ color: "var(--text-muted)" }}>{hint}</span>}
      </div>
      {children}
    </div>
  );
}
