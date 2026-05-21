"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/trpc/client";
import { ArrowLeft, Loader2, Target } from "lucide-react";

function Field({ label, name, value, onChange, type = "text", placeholder }: {
  label: string; name: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--text-muted)" }}>
        {label}
      </label>
      <input
        type={type}
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2.5 rounded-xl text-sm outline-none transition-all"
        style={{
          background: "var(--surface-elevated)",
          border: "1px solid var(--surface-border)",
          color: "var(--text-primary)",
        }}
      />
    </div>
  );
}

function TextArea({ label, name, value, onChange, placeholder, rows = 3 }: {
  label: string; name: string; value: string; onChange: (v: string) => void;
  placeholder?: string; rows?: number;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--text-muted)" }}>
        {label}
      </label>
      <textarea
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full px-3 py-2.5 rounded-xl text-sm outline-none transition-all resize-none"
        style={{
          background: "var(--surface-elevated)",
          border: "1px solid var(--surface-border)",
          color: "var(--text-primary)",
        }}
      />
    </div>
  );
}

export default function NewLeadPage() {
  const router = useRouter();
  const create = api.leads.create.useMutation({ onSuccess: (lead) => router.push(`/leads/${lead!.id}`) });

  const [form, setForm] = useState({
    firstName: "", lastName: "", email: "", phone: "", linkedIn: "",
    company: "", website: "", industry: "", companySize: "", region: "", jobTitle: "",
    techStack: "", painPoints: "", scrapedData: "", notes: "",
  });

  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    create.mutate({ ...form, source: "manual" });
  }

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <Link href="/leads" className="flex items-center gap-1.5 text-sm transition-opacity hover:opacity-70" style={{ color: "var(--text-secondary)" }}>
          <ArrowLeft className="w-3.5 h-3.5" /> Leads
        </Link>
        <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Add Lead</span>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Identity */}
        <section
          className="rounded-2xl p-6 space-y-4"
          style={{ background: "var(--surface-card)", border: "1px solid var(--surface-border)" }}
        >
          <h2 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Identity</h2>
          <div className="grid grid-cols-2 gap-4">
            <Field label="First Name" name="firstName" value={form.firstName} onChange={set("firstName")} />
            <Field label="Last Name" name="lastName" value={form.lastName} onChange={set("lastName")} />
          </div>
          <Field label="Job Title" name="jobTitle" value={form.jobTitle} onChange={set("jobTitle")} placeholder="CEO, Head of Product…" />
          <div className="grid grid-cols-2 gap-4">
            <Field label="Email" name="email" value={form.email} onChange={set("email")} type="email" />
            <Field label="Phone" name="phone" value={form.phone} onChange={set("phone")} />
          </div>
          <Field label="LinkedIn URL" name="linkedIn" value={form.linkedIn} onChange={set("linkedIn")} placeholder="https://linkedin.com/in/…" />
        </section>

        {/* Company */}
        <section
          className="rounded-2xl p-6 space-y-4"
          style={{ background: "var(--surface-card)", border: "1px solid var(--surface-border)" }}
        >
          <h2 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Company</h2>
          <Field label="Company Name" name="company" value={form.company} onChange={set("company")} />
          <div className="grid grid-cols-2 gap-4">
            <Field label="Website" name="website" value={form.website} onChange={set("website")} placeholder="https://…" />
            <Field label="Industry" name="industry" value={form.industry} onChange={set("industry")} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Company Size" name="companySize" value={form.companySize} onChange={set("companySize")} placeholder="1-10, 11-50, 51-200…" />
            <Field label="Region" name="region" value={form.region} onChange={set("region")} placeholder="US, UK, EU…" />
          </div>
        </section>

        {/* Intelligence */}
        <section
          className="rounded-2xl p-6 space-y-4"
          style={{ background: "var(--surface-card)", border: "1px solid var(--surface-border)" }}
        >
          <h2 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Intelligence</h2>
          <TextArea label="Tech Stack" name="techStack" value={form.techStack} onChange={set("techStack")} placeholder="What tools/tech do they currently use?" rows={2} />
          <TextArea label="Pain Points" name="painPoints" value={form.painPoints} onChange={set("painPoints")} placeholder="What problems are they facing?" rows={3} />
          <TextArea label="Scraped Data" name="scrapedData" value={form.scrapedData} onChange={set("scrapedData")} placeholder="Paste raw scraped data here…" rows={4} />
          <TextArea label="Notes" name="notes" value={form.notes} onChange={set("notes")} placeholder="Internal notes…" rows={2} />
        </section>

        <div className="flex gap-3 justify-end">
          <Link
            href="/leads"
            className="px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors"
            style={{ background: "var(--surface-elevated)", color: "var(--text-secondary)", border: "1px solid var(--surface-border)" }}
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={create.isPending}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-60"
            style={{ background: "var(--brand-gradient)" }}
          >
            {create.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Target className="w-4 h-4" />}
            Add Lead
          </button>
        </div>
      </form>
    </div>
  );
}
