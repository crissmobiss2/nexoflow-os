"use client";

import { useState } from "react";
import { api } from "@/lib/trpc/client";

type Step = "form" | "success";

const PROMO_OPTIONS = [
  "Agency / consultancy",
  "Content creator / blogger",
  "LinkedIn / social media",
  "Podcast / newsletter",
  "Accountant / bookkeeper",
  "Business coach / advisor",
  "Marketing agency",
  "Tech partner",
  "Other",
];

export default function AffiliateJoinPage() {
  const [step, setStep] = useState<Step>("form");
  const [form, setForm] = useState({ name: "", email: "", website: "", promoMethod: "" });
  const [error, setError] = useState<string | null>(null);
  const [createdCode, setCreatedCode] = useState<string | null>(null);

  const createMutation = api.affiliates.create.useMutation({
    onSuccess: (data) => {
      setCreatedCode(data?.referralCode ?? null);
      setStep("success");
    },
    onError: (e) => setError(e.message),
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.name.trim() || !form.email.trim()) {
      setError("Name and email are required.");
      return;
    }
    createMutation.mutate({
      name: form.name.trim(),
      email: form.email.trim(),
      website: form.website.trim() || undefined,
      promoMethod: form.promoMethod || undefined,
    });
  }

  if (step === "success") {
    return (
      <div style={styles.page}>
        <div style={{ ...styles.card, maxWidth: 560, textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 20 }}>🎉</div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#e2e8f0", marginBottom: 10 }}>Application received!</h1>
          <p style={{ color: "#666", fontSize: 14, lineHeight: 1.7, marginBottom: 28 }}>
            We review applications within <strong style={{ color: "#a78bfa" }}>24 hours</strong>. Once approved, you'll get access
            to your personal affiliate portal with your unique referral link and live commission tracking.
          </p>

          {/* Commission structure */}
          <div style={{ background: "#0a0a0f", border: "1px solid #1e1e2e", borderRadius: 12, padding: "20px 24px", marginBottom: 16, textAlign: "left" }}>
            <div style={{ fontSize: 11, color: "#444", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 14 }}>Commission Structure</div>
            {[
              { tier: "Standard", rate: "10%", desc: "$10,000 – $20,000 projects", color: "#60a5fa" },
              { tier: "Elite", rate: "20%", desc: "$20,000+ projects", color: "#a78bfa" },
            ].map((t) => (
              <div key={t.tier} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #111" }}>
                <div>
                  <span style={{ fontSize: 13, color: "#e2e8f0", fontWeight: 600 }}>{t.tier}</span>
                  <span style={{ fontSize: 12, color: "#555", marginLeft: 10 }}>{t.desc}</span>
                </div>
                <span style={{ fontSize: 15, fontWeight: 700, color: t.color }}>{t.rate}</span>
              </div>
            ))}
            <div style={{ marginTop: 14, fontSize: 12, color: "#444", lineHeight: 1.6 }}>
              Commissions paid monthly on the <strong style={{ color: "#666" }}>15th</strong> via PayPal or bank transfer.
              Minimum payout <strong style={{ color: "#666" }}>$50</strong>. 90-day attribution cookie.
            </div>
          </div>

          {/* Bonus programs teaser */}
          <div style={{ background: "#0a0a0f", border: "1px solid #1e1e2e", borderRadius: 12, padding: "16px 20px", marginBottom: 24, textAlign: "left" }}>
            <div style={{ fontSize: 11, color: "#444", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>Bonus Programs</div>
            {[
              { icon: "🔄", label: "Recurring Commissions", desc: "5-10% on retainer for 12 months" },
              { icon: "⚡", label: "Tier Escalation", desc: "3+ clients in 6 months → permanent 20%" },
              { icon: "👥", label: "Affiliate Referral Bonus", desc: "$500–$1,000 per affiliate you refer" },
              { icon: "🏆", label: "Top Performer Bonus", desc: "$1,500 completion bonus for high volume" },
            ].map((b) => (
              <div key={b.label} style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 10 }}>
                <span style={{ fontSize: 16, flexShrink: 0 }}>{b.icon}</span>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#e2e8f0" }}>{b.label}</div>
                  <div style={{ fontSize: 11, color: "#555" }}>{b.desc}</div>
                </div>
              </div>
            ))}
          </div>

          <p style={{ fontSize: 12, color: "#444" }}>
            Questions? Email <span style={{ color: "#a78bfa" }}>team@nexoflow.tech</span>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={{ ...styles.card, maxWidth: 560 }}>
        {/* Header */}
        <div style={{ marginBottom: 32, textAlign: "center" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#a78bfa", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>
            NexoFlow Affiliate Program
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: "#e2e8f0", marginBottom: 10, lineHeight: 1.2 }}>
            Earn 10–20% on every<br />project you refer
          </h1>
          <p style={{ color: "#555", fontSize: 14, lineHeight: 1.7 }}>
            Refer businesses that need custom software, AI tools, or automation
            and earn commission when they become clients.
          </p>
        </div>

        {/* Key stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 24 }}>
          {[
            { value: "$7,900+", label: "avg per referral" },
            { value: "90 days", label: "cookie window" },
            { value: "24 hrs", label: "approval time" },
            { value: "$50 min", label: "payout threshold" },
          ].map((s) => (
            <div key={s.label} style={{ background: "#0a0a0f", border: "1px solid #1e1e2e", borderRadius: 10, padding: "10px 6px", textAlign: "center" }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#a78bfa" }}>{s.value}</div>
              <div style={{ fontSize: 10, color: "#444", marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Commission tiers */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10, marginBottom: 28 }}>
          {[
            { tier: "Standard", pct: "10%", range: "$10k – $20k", color: "#60a5fa", desc: "Perfect starting point" },
            { tier: "Elite", pct: "20%", range: "$20k+ projects", color: "#a78bfa", desc: "Double your earnings" },
          ].map((t) => (
            <div key={t.tier} style={{ background: "#0a0a0f", border: "1px solid #1e1e2e", borderRadius: 10, padding: "14px 16px" }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: t.color }}>{t.pct}</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0", marginTop: 2 }}>{t.tier}</div>
              <div style={{ fontSize: 11, color: "#555", marginTop: 2 }}>{t.range}</div>
              <div style={{ fontSize: 10, color: "#444", marginTop: 4 }}>{t.desc}</div>
            </div>
          ))}
        </div>

        {/* Form */}
        <form onSubmit={submit}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label style={styles.label}>Full Name *</label>
              <input
                style={styles.input}
                type="text"
                placeholder="Jane Smith"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>

            <div>
              <label style={styles.label}>Email Address *</label>
              <input
                style={styles.input}
                type="email"
                placeholder="jane@agency.com"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>

            <div>
              <label style={styles.label}>Website (optional)</label>
              <input
                style={styles.input}
                type="url"
                placeholder="https://youragency.com"
                value={form.website}
                onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))}
              />
            </div>

            <div>
              <label style={styles.label}>How will you promote NexoFlow?</label>
              <select
                style={{ ...styles.input, cursor: "pointer" }}
                value={form.promoMethod}
                onChange={(e) => setForm((f) => ({ ...f, promoMethod: e.target.value }))}
              >
                <option value="">Select an option…</option>
                {PROMO_OPTIONS.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </div>

            {error && (
              <div style={{ background: "#ef44441a", border: "1px solid #ef444433", borderRadius: 8, padding: "10px 14px", color: "#ef4444", fontSize: 13 }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={createMutation.isPending}
              style={{ marginTop: 6, padding: "13px 0", borderRadius: 10, background: "linear-gradient(135deg, #7c5cbf, #a855f7)", color: "#fff", fontWeight: 700, fontSize: 15, border: "none", cursor: createMutation.isPending ? "not-allowed" : "pointer", opacity: createMutation.isPending ? 0.7 : 1, transition: "opacity 0.15s" }}
            >
              {createMutation.isPending ? "Submitting…" : "Apply to Join →"}
            </button>
          </div>
        </form>

        <div style={{ marginTop: 20, textAlign: "center", fontSize: 12, color: "#444" }}>
          Already approved?{" "}
          <a href="/portal/affiliate" style={{ color: "#a78bfa" }}>Access your portal</a>
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#0a0a0f",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "40px 16px",
    fontFamily: "Inter, system-ui, sans-serif",
  } as React.CSSProperties,
  card: {
    width: "100%",
    background: "#111118",
    border: "1px solid #1e1e2e",
    borderRadius: 18,
    padding: "36px 32px",
    color: "#e2e8f0",
  } as React.CSSProperties,
  label: {
    display: "block",
    fontSize: 12,
    fontWeight: 600,
    color: "#666",
    marginBottom: 6,
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
  } as React.CSSProperties,
  input: {
    width: "100%",
    background: "#0a0a0f",
    border: "1px solid #1e1e2e",
    borderRadius: 8,
    padding: "10px 14px",
    color: "#e2e8f0",
    fontSize: 14,
    outline: "none",
    boxSizing: "border-box" as const,
    appearance: "none" as const,
  } as React.CSSProperties,
};
