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
        <div style={{ ...styles.card, maxWidth: 540, textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 20 }}>🎉</div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#e2e8f0", marginBottom: 10 }}>Application received!</h1>
          <p style={{ color: "#666", fontSize: 14, lineHeight: 1.7, marginBottom: 28 }}>
            We review applications within 1–2 business days. Once approved, you'll get access
            to your personal affiliate portal with your unique referral link and live commission tracking.
          </p>

          <div style={{ background: "#0a0a0f", border: "1px solid #1e1e2e", borderRadius: 10, padding: "16px 20px", marginBottom: 28, textAlign: "left" }}>
            <div style={{ fontSize: 11, color: "#444", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Commission structure</div>
            {[
              { tier: "Base", rate: "10%", deals: "0–4 deals / year" },
              { tier: "Silver", rate: "12%", deals: "5–19 deals / year" },
              { tier: "Gold", rate: "15%", deals: "20+ deals / year" },
            ].map((t) => (
              <div key={t.tier} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #111" }}>
                <span style={{ fontSize: 13, color: "#888" }}>{t.tier} — {t.deals}</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: "#a78bfa" }}>{t.rate}</span>
              </div>
            ))}
            <div style={{ marginTop: 10, fontSize: 12, color: "#444" }}>
              Commissions are calculated on confirmed project value and paid within 30 days of project start.
            </div>
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
            Earn 10–15% on every<br />project you refer
          </h1>
          <p style={{ color: "#555", fontSize: 14, lineHeight: 1.7 }}>
            Refer businesses that need custom software, AI tools, or automation
            and earn commission when they become clients.
          </p>
        </div>

        {/* Commission tiers at a glance */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 28 }}>
          {[
            { tier: "Base", pct: "10%", color: "#60a5fa" },
            { tier: "Silver", pct: "12%", color: "#94a3b8" },
            { tier: "Gold", pct: "15%", color: "#f59e0b" },
          ].map((t) => (
            <div key={t.tier} style={{ background: "#0a0a0f", border: "1px solid #1e1e2e", borderRadius: 10, padding: "12px 0", textAlign: "center" }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: t.color }}>{t.pct}</div>
              <div style={{ fontSize: 11, color: "#555", marginTop: 3 }}>{t.tier}</div>
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
