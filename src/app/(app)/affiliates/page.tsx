"use client";

import { useState } from "react";
import { api } from "@/lib/trpc/client";
import {
  Users, CheckCircle2, XCircle, DollarSign, TrendingUp,
  Copy, Loader2, Star, Award, Zap, ChevronDown, ChevronUp,
  MousePointerClick, Phone, Trophy, CreditCard, ExternalLink,
} from "lucide-react";

// ─── Config ───────────────────────────────────────────────────────────────────

const TIER_CONFIG = {
  base:   { label: "Standard",  color: "hsl(220, 90%, 62%)",  bg: "hsl(220, 90%, 62%, 0.12)",  icon: Zap },
  silver: { label: "Standard",  color: "hsl(220, 90%, 62%)",  bg: "hsl(220, 90%, 62%, 0.12)",  icon: Zap },
  gold:   { label: "Elite 20%", color: "hsl(262, 83%, 68%)",  bg: "hsl(262, 83%, 68%, 0.12)",  icon: Award },
};

const STATUS_CONFIG = {
  pending:   { label: "Pending",   color: "hsl(35, 90%, 60%)",  bg: "hsl(35, 90%, 60%, 0.12)"  },
  approved:  { label: "Approved",  color: "hsl(142, 68%, 52%)", bg: "hsl(142, 68%, 52%, 0.12)" },
  rejected:  { label: "Rejected",  color: "hsl(0, 70%, 60%)",   bg: "hsl(0, 70%, 60%, 0.12)"   },
  suspended: { label: "Suspended", color: "hsl(220, 14%, 55%)", bg: "hsl(220, 14%, 55%, 0.1)"  },
};

const OUTCOME_COLOR: Record<string, string> = {
  won: "hsl(142, 68%, 52%)", lost: "hsl(0, 70%, 60%)", no_show: "var(--text-muted)",
  follow_up: "hsl(35, 90%, 60%)", not_interested: "var(--text-muted)", rescheduled: "hsl(262, 83%, 68%)",
};
const OUTCOME_LABEL: Record<string, string> = {
  won: "Won", lost: "Lost", no_show: "No Show",
  follow_up: "Follow Up", not_interested: "Not Interested", rescheduled: "Rescheduled",
};

function money(cents: number) {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}
function fmtDate(d: Date | string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ─── Types ────────────────────────────────────────────────────────────────────

type AffiliateRow = {
  id: string; name: string; email: string; tier: "base" | "silver" | "gold";
  status: "pending" | "approved" | "rejected" | "suspended";
  referralCode: string; totalReferrals: number; totalEarningsCents: number;
  paidOutCents: number; promoMethod: string | null; paypalEmail: string | null;
  clickCount: number; pendingReferrals: number; convertedReferrals: number;
  createdAt: Date;
};

// ─── Modals ───────────────────────────────────────────────────────────────────

function LogConversionModal({ affiliate, onClose, onSuccess }: {
  affiliate: AffiliateRow;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [leadId, setLeadId] = useState("");
  const [value, setValue] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Fetch affiliate's leads for the dropdown
  const { data: journey } = api.affiliates.getJourney.useQuery({ code: affiliate.referralCode });

  const logMutation = api.affiliates.logConversion.useMutation({
    onSuccess: () => { onSuccess(); onClose(); },
    onError: (e) => setError(e.message),
  });

  const valueCents = Math.round(parseFloat(value || "0") * 100);
  const pct = affiliate.tier === "gold" ? 20 : valueCents >= 2_000_000 ? 20 : 10;
  const commissionPreview = Math.round(valueCents * (pct / 100));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!leadId) { setError("Select a lead."); return; }
    if (!value || valueCents < 1) { setError("Enter a project value."); return; }
    logMutation.mutate({ affiliateId: affiliate.id, leadId, projectValueCents: valueCents, notes: notes.trim() || undefined });
  }

  return (
    <Overlay onClose={onClose}>
      <div style={modalStyle}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>Log Conversion</h2>
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 20 }}>
          Record a deal closed for <strong>{affiliate.name}</strong>. Commission auto-calculated: 10% (&lt;$20k) or 20% ($20k+){affiliate.tier === "gold" ? " — Elite tier (flat 20%)" : ""}.
        </p>

        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Field label="Lead *">
            <select
              style={inputStyle}
              value={leadId}
              onChange={(e) => setLeadId(e.target.value)}
            >
              <option value="">Select a lead…</option>
              {journey?.pipeline.map((p) => {
                const name = [p.lead.firstName, p.lead.lastName].filter(Boolean).join(" ") || p.lead.company || p.lead.email || p.lead.id.slice(0, 8);
                return <option key={p.lead.id} value={p.lead.id}>{name}{p.lead.company ? ` · ${p.lead.company}` : ""}</option>;
              })}
            </select>
          </Field>

          <Field label="Project Value (USD) *">
            <input
              style={inputStyle}
              type="number"
              min="0"
              step="100"
              placeholder="e.g. 8500"
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
            {valueCents > 0 && (
              <div style={{ marginTop: 6, fontSize: 12, color: "hsl(142, 68%, 52%)" }}>
                Commission: {money(commissionPreview)} ({pct}% of {money(valueCents)})
              </div>
            )}
          </Field>

          <Field label="Notes (optional)">
            <textarea
              style={{ ...inputStyle, height: 70, resize: "none" }}
              placeholder="Project type, timeline notes…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </Field>

          {error && <ErrorMsg>{error}</ErrorMsg>}

          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 4 }}>
            <button type="button" onClick={onClose} style={ghostBtn}>Cancel</button>
            <button type="submit" disabled={logMutation.isPending} style={primaryBtn}>
              {logMutation.isPending ? "Saving…" : "Log Conversion"}
            </button>
          </div>
        </form>
      </div>
    </Overlay>
  );
}

function PayoutModal({ affiliate, onClose, onSuccess }: {
  affiliate: AffiliateRow;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const unpaid = affiliate.totalEarningsCents - affiliate.paidOutCents;
  const [amount, setAmount] = useState(String(unpaid / 100));
  const [method, setMethod] = useState("paypal");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const payoutMutation = api.affiliates.processPayout.useMutation({
    onSuccess: () => { onSuccess(); onClose(); },
    onError: (e) => setError(e.message),
  });

  const amountCents = Math.round(parseFloat(amount || "0") * 100);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (amountCents < 1) { setError("Enter an amount."); return; }
    payoutMutation.mutate({
      affiliateId: affiliate.id,
      amountCents,
      method: method as "paypal" | "bank_transfer" | "wise" | "stripe",
      reference: reference.trim() || undefined,
      notes: notes.trim() || undefined,
    });
  }

  return (
    <Overlay onClose={onClose}>
      <div style={modalStyle}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>Process Payout</h2>
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 20 }}>
          Unpaid balance for <strong>{affiliate.name}</strong>: <strong style={{ color: "hsl(35, 90%, 60%)" }}>{money(unpaid)}</strong>
          {affiliate.paypalEmail && <span style={{ color: "var(--text-muted)" }}> · PayPal: {affiliate.paypalEmail}</span>}
        </p>

        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Field label="Amount (USD) *">
            <input style={inputStyle} type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </Field>

          <Field label="Method *">
            <select style={{ ...inputStyle, cursor: "pointer" }} value={method} onChange={(e) => setMethod(e.target.value)}>
              <option value="paypal">PayPal</option>
              <option value="bank_transfer">Bank Transfer</option>
              <option value="wise">Wise</option>
              <option value="stripe">Stripe</option>
            </select>
          </Field>

          <Field label="Reference / Transaction ID">
            <input style={inputStyle} type="text" placeholder="e.g. PAY-123456" value={reference} onChange={(e) => setReference(e.target.value)} />
          </Field>

          <Field label="Notes">
            <input style={inputStyle} type="text" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>

          {error && <ErrorMsg>{error}</ErrorMsg>}

          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 4 }}>
            <button type="button" onClick={onClose} style={ghostBtn}>Cancel</button>
            <button type="submit" disabled={payoutMutation.isPending} style={primaryBtn}>
              {payoutMutation.isPending ? "Processing…" : `Send ${amountCents > 0 ? money(amountCents) : ""}`}
            </button>
          </div>
        </form>
      </div>
    </Overlay>
  );
}

// ─── Affiliate Detail Drawer ──────────────────────────────────────────────────

function AffiliateDetail({ affiliate, refetchAll }: { affiliate: AffiliateRow; refetchAll: () => void }) {
  const { data: journey, isLoading } = api.affiliates.getJourney.useQuery({ code: affiliate.referralCode });

  const markPaidMutation = api.affiliates.markReferralPaid.useMutation({ onSuccess: refetchAll });

  if (isLoading) return (
    <div style={{ padding: "24px 32px", display: "flex", alignItems: "center", gap: 8, color: "var(--text-muted)", fontSize: 13 }}>
      <Loader2 className="w-4 h-4 animate-spin" /> Loading journey…
    </div>
  );

  if (!journey) return null;

  const { pipeline, clickStats, payouts } = journey;

  return (
    <div style={{ padding: "0 0 8px 0", borderTop: "1px solid var(--surface-border-subtle)" }}>

      {/* Journey Mini-stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 0, borderBottom: "1px solid var(--surface-border-subtle)" }}>
        {[
          { icon: MousePointerClick, label: "Clicks", value: clickStats.total, color: "hsl(220, 90%, 62%)" },
          { icon: Users, label: "Leads", value: pipeline.length, color: "hsl(262, 83%, 68%)" },
          { icon: Phone, label: "Calls Booked", value: pipeline.filter((p) => p.callBooked).length, color: "hsl(262, 60%, 65%)" },
          { icon: TrendingUp, label: "Calls Completed", value: pipeline.filter((p) => p.callCompletedAt).length, color: "hsl(35, 90%, 60%)" },
          { icon: Trophy, label: "Deals Won", value: pipeline.filter((p) => p.dealWon).length, color: "hsl(142, 68%, 52%)" },
        ].map(({ icon: Icon, label, value, color }) => (
          <div key={label} style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: 10, borderRight: "1px solid var(--surface-border-subtle)" }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: `${color}1a`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Icon size={14} style={{ color }} />
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", lineHeight: 1 }}>{value}</div>
              <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Lead Pipeline */}
      <div style={{ padding: "16px 20px" }}>
        {pipeline.length === 0 ? (
          <div style={{ fontSize: 13, color: "var(--text-muted)", textAlign: "center", padding: "16px 0" }}>
            No leads attributed yet. Share <code style={{ fontSize: 12, color: "var(--text-secondary)" }}>nexoflow.tech/ref/{affiliate.referralCode}</code>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {pipeline.map((item) => {
              const name = [item.lead.firstName, item.lead.lastName].filter(Boolean).join(" ") || item.lead.company || item.lead.email || "Unknown";

              return (
                <div key={item.lead.id} style={{ display: "grid", alignItems: "center", gap: 12, padding: "12px 16px", borderRadius: 10, background: "var(--surface-elevated)", gridTemplateColumns: "1.4fr 1fr 1fr 1fr 100px" }}>
                  {/* Lead */}
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{name}</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>Referred {fmtDate(item.lead.createdAt)}</div>
                  </div>

                  {/* Call */}
                  <div>
                    {item.callBooked ? (
                      <div>
                        <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>📅 {fmtDate(item.callScheduledAt)}</div>
                        {item.callOutcome && (
                          <div style={{ fontSize: 11, marginTop: 2, fontWeight: 600, color: OUTCOME_COLOR[item.callOutcome] ?? "var(--text-muted)" }}>
                            {OUTCOME_LABEL[item.callOutcome] ?? item.callOutcome}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span style={{ fontSize: 11, color: "var(--text-muted)" }}>No call yet</span>
                    )}
                  </div>

                  {/* Deal */}
                  <div>
                    {item.dealWon ? (
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "hsl(142, 68%, 52%)" }}>
                          {item.wonValueCents ? money(item.wonValueCents) : "Won"}
                        </div>
                        <div style={{ fontSize: 10, color: "var(--text-muted)" }}>deal value</div>
                      </div>
                    ) : (
                      <span style={{ fontSize: 11, color: "var(--text-muted)" }}>—</span>
                    )}
                  </div>

                  {/* Commission */}
                  <div>
                    {item.referral ? (
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: item.referral.status === "paid" ? "hsl(142, 68%, 52%)" : "hsl(35, 90%, 60%)" }}>
                          {money(item.referral.commissionCents ?? 0)}
                        </div>
                        <div style={{ fontSize: 10, fontWeight: 600, color: item.referral.status === "paid" ? "hsl(142, 68%, 52%)" : "hsl(35, 90%, 60%)", textTransform: "uppercase", marginTop: 1 }}>
                          {item.referral.status}
                        </div>
                      </div>
                    ) : (
                      <span style={{ fontSize: 11, color: "var(--text-muted)" }}>—</span>
                    )}
                  </div>

                  {/* Action */}
                  <div>
                    {item.referral && item.referral.status !== "paid" && (
                      <button
                        onClick={() => markPaidMutation.mutate({ referralId: item.referral!.id })}
                        disabled={markPaidMutation.isPending}
                        style={{ fontSize: 11, padding: "5px 10px", borderRadius: 6, background: "hsl(142 68% 52% / 0.12)", color: "hsl(142, 68%, 52%)", border: "none", cursor: "pointer", fontWeight: 600, whiteSpace: "nowrap" }}
                      >
                        Mark Paid
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Payout history */}
        {payouts.length > 0 && (
          <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--surface-border-subtle)" }}>
            <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Payout History</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {payouts.map((p) => (
                <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, color: "var(--text-secondary)" }}>
                  <span>{fmtDate(p.completedAt ?? p.createdAt)} · {p.method.replace("_", " ")}{p.reference ? ` · ${p.reference}` : ""}</span>
                  <span style={{ fontWeight: 700, color: "hsl(142, 68%, 52%)" }}>{money(p.amountCents)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AffiliatesPage() {
  const [filterStatus, setFilterStatus] = useState<string | undefined>(undefined);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [conversionModal, setConversionModal] = useState<AffiliateRow | null>(null);
  const [payoutModal, setPayoutModal] = useState<AffiliateRow | null>(null);

  const { data: affiliateList = [], isLoading, refetch } = api.affiliates.list.useQuery(
    filterStatus ? { status: filterStatus as "pending" | "approved" | "rejected" | "suspended" } : undefined,
  );
  const { data: stats, refetch: refetchStats } = api.affiliates.stats.useQuery();

  const refetchAll = () => { void refetch(); void refetchStats(); };
  const approveMutation = api.affiliates.approve.useMutation({ onSuccess: refetchAll });
  const rejectMutation = api.affiliates.reject.useMutation({ onSuccess: refetchAll });
  const updateMutation = api.affiliates.update.useMutation({ onSuccess: refetchAll });

  const affiliates = affiliateList as AffiliateRow[];

  function copyLink(code: string) {
    void navigator.clipboard.writeText(`https://nexoflow.tech/ref/${code}`);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  }

  function toggleExpand(id: string) {
    setExpandedId((prev) => prev === id ? null : id);
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-1.5 h-5 rounded-full" style={{ background: "var(--brand-gradient)" }} />
            <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>Affiliate Program</h1>
          </div>
          <p className="text-sm pl-3.5" style={{ color: "var(--text-secondary)" }}>
            Full pipeline: clicks → leads → calls → deals → commissions
          </p>
        </div>
        <a
          href="/portal/affiliate/join"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg transition-opacity hover:opacity-80"
          style={{ background: "var(--surface-card)", color: "var(--text-secondary)", border: "1px solid var(--surface-border)" }}
        >
          <ExternalLink className="w-3 h-3" /> Public Sign-up Page
        </a>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Total Affiliates", value: stats.total, sub: `${stats.pending} pending`, icon: Users, color: "hsl(220, 90%, 62%)" },
            { label: "Active Partners", value: stats.approved, sub: "approved", icon: CheckCircle2, color: "hsl(142, 68%, 52%)" },
            { label: "Total Clicks", value: stats.totalClicks, sub: `${stats.totalReferrals} leads`, icon: MousePointerClick, color: "hsl(262, 83%, 68%)" },
            { label: "Total Earned", value: money(stats.totalEarningsCents), sub: `${money(stats.paidOutCents)} paid`, icon: DollarSign, color: "hsl(40, 90%, 58%)" },
          ].map(({ label, value, sub, icon: Icon, color }) => (
            <div key={label} className="rounded-2xl p-5" style={{ background: "var(--surface-card)", border: "1px solid var(--surface-border)" }}>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${color}1a` }}>
                  <Icon className="w-3.5 h-3.5" style={{ color }} />
                </div>
                <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>{label}</span>
              </div>
              <div className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>{value}</div>
              <div className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>{sub}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-2 mb-6">
        {([undefined, "pending", "approved", "rejected"] as const).map((s) => {
          const cfg = s ? STATUS_CONFIG[s] : null;
          return (
            <button
              key={s ?? "all"}
              onClick={() => setFilterStatus(s)}
              className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
              style={filterStatus === s
                ? { background: cfg?.color ?? "var(--brand-gradient)", color: "white" }
                : { background: "var(--surface-card)", color: "var(--text-secondary)", border: "1px solid var(--surface-border)" }
              }
            >
              {s ? STATUS_CONFIG[s].label : `All (${affiliates.length})`}
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="w-5 h-5 animate-spin" style={{ color: "var(--text-muted)" }} />
        </div>
      ) : affiliates.length === 0 ? (
        <div className="rounded-2xl flex flex-col items-center justify-center py-24 text-center"
          style={{ background: "var(--surface-card)", border: "1px solid var(--surface-border)" }}>
          <Users className="w-10 h-10 mb-4" style={{ color: "var(--text-muted)" }} />
          <p className="text-sm font-medium mb-1" style={{ color: "var(--text-primary)" }}>No affiliates yet</p>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Applications come from <code className="text-[11px]">nexoflow.tech/portal/affiliate/join</code>
          </p>
        </div>
      ) : (
        <div className="rounded-2xl overflow-hidden" style={{ background: "var(--surface-card)", border: "1px solid var(--surface-border)" }}>
          {/* Table header */}
          <div className="grid px-6 py-3 text-[11px] font-semibold uppercase tracking-wider"
            style={{ borderBottom: "1px solid var(--surface-border)", color: "var(--text-muted)", gridTemplateColumns: "2fr 100px 80px 80px 80px 130px 200px 28px" }}>
            {["Affiliate", "Tier", "Clicks", "Leads", "Deals", "Earned", "Actions", ""].map((h) => (
              <div key={h}>{h}</div>
            ))}
          </div>

          {affiliates.map((aff) => {
            const tierCfg = TIER_CONFIG[aff.tier];
            const statusCfg = STATUS_CONFIG[aff.status];
            const TierIcon = tierCfg.icon;
            const unpaid = aff.totalEarningsCents - aff.paidOutCents;
            const isExpanded = expandedId === aff.id;

            return (
              <div key={aff.id} style={{ borderBottom: "1px solid var(--surface-border-subtle)" }}>
                {/* Row */}
                <div className="grid items-center px-6 py-4"
                  style={{ gridTemplateColumns: "2fr 100px 80px 80px 80px 130px 200px 28px" }}>

                  {/* Affiliate info */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0"
                        style={{ background: "var(--brand-gradient)", color: "white" }}>
                        {aff.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>{aff.name}</div>
                        <div className="text-[11px] truncate" style={{ color: "var(--text-muted)" }}>{aff.email}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 ml-9">
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: statusCfg.bg, color: statusCfg.color }}>
                        {statusCfg.label}
                      </span>
                      {aff.status === "approved" && (
                        <button
                          onClick={() => copyLink(aff.referralCode)}
                          className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded hover:opacity-70 transition-opacity"
                          style={{ color: copiedCode === aff.referralCode ? "hsl(142, 68%, 52%)" : "var(--text-muted)" }}
                        >
                          {copiedCode === aff.referralCode ? <CheckCircle2 className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                          /ref/{aff.referralCode}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Tier */}
                  <div>
                    <span className="flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-full w-fit"
                      style={{ background: tierCfg.bg, color: tierCfg.color }}>
                      <TierIcon className="w-3 h-3" />{tierCfg.label.split(" ")[0]}
                    </span>
                  </div>

                  {/* Clicks */}
                  <div className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                    {aff.clickCount}
                  </div>

                  {/* Leads */}
                  <div>
                    <div className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{aff.totalReferrals}</div>
                    {aff.convertedReferrals > 0 && (
                      <div className="text-[11px]" style={{ color: "hsl(142, 68%, 52%)" }}>{aff.convertedReferrals} won</div>
                    )}
                  </div>

                  {/* Deals won */}
                  <div className="text-sm font-semibold" style={{ color: aff.convertedReferrals > 0 ? "hsl(142, 68%, 52%)" : "var(--text-muted)" }}>
                    {aff.convertedReferrals}
                  </div>

                  {/* Earned */}
                  <div>
                    <div className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{money(aff.totalEarningsCents)}</div>
                    {unpaid > 0 && (
                      <div className="text-[11px]" style={{ color: "hsl(35, 90%, 60%)" }}>{money(unpaid)} unpaid</div>
                    )}
                    {aff.paidOutCents > 0 && (
                      <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>{money(aff.paidOutCents)} paid</div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {aff.status === "pending" && (
                      <>
                        <button
                          onClick={() => approveMutation.mutate({ id: aff.id })}
                          disabled={approveMutation.isPending}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-opacity hover:opacity-80 disabled:opacity-50"
                          style={{ background: "hsl(142 68% 52% / 0.15)", color: "hsl(142, 68%, 52%)" }}
                        >
                          <CheckCircle2 className="w-3 h-3" /> Approve
                        </button>
                        <button
                          onClick={() => rejectMutation.mutate({ id: aff.id })}
                          disabled={rejectMutation.isPending}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-opacity hover:opacity-80 disabled:opacity-50"
                          style={{ background: "hsl(0 70% 60% / 0.12)", color: "hsl(0, 70%, 60%)" }}
                        >
                          <XCircle className="w-3 h-3" /> Reject
                        </button>
                      </>
                    )}
                    {aff.status === "approved" && (
                      <>
                        <select
                          value={aff.tier}
                          onChange={(e) => updateMutation.mutate({ id: aff.id, tier: e.target.value as "base" | "silver" | "gold" })}
                          className="text-[11px] px-2 py-1.5 rounded-lg font-semibold"
                          style={{ background: "var(--surface-elevated)", color: "var(--text-secondary)", border: "1px solid var(--surface-border)" }}
                        >
                          <option value="base">Standard (10–20%)</option>
                          <option value="gold">Elite (20% flat)</option>
                        </select>
                        <button
                          onClick={() => setConversionModal(aff)}
                          className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-semibold transition-opacity hover:opacity-80"
                          style={{ background: "hsl(142 68% 52% / 0.12)", color: "hsl(142, 68%, 52%)" }}
                          title="Log a deal conversion"
                        >
                          <Trophy className="w-3 h-3" /> Conversion
                        </button>
                        {unpaid > 0 && (
                          <button
                            onClick={() => setPayoutModal(aff)}
                            className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-semibold transition-opacity hover:opacity-80"
                            style={{ background: "hsl(35 90% 60% / 0.12)", color: "hsl(35, 90%, 60%)" }}
                            title="Send payout"
                          >
                            <CreditCard className="w-3 h-3" /> Payout
                          </button>
                        )}
                      </>
                    )}
                  </div>

                  {/* Expand toggle */}
                  <button
                    onClick={() => toggleExpand(aff.id)}
                    className="flex items-center justify-center w-6 h-6 rounded transition-opacity hover:opacity-70"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>

                {/* Expanded detail */}
                {isExpanded && <AffiliateDetail affiliate={aff} refetchAll={refetchAll} />}
              </div>
            );
          })}
        </div>
      )}

      {/* Modals */}
      {conversionModal && (
        <LogConversionModal
          affiliate={conversionModal}
          onClose={() => setConversionModal(null)}
          onSuccess={refetchAll}
        />
      )}
      {payoutModal && (
        <PayoutModal
          affiliate={payoutModal}
          onClose={() => setPayoutModal(null)}
          onSuccess={refetchAll}
        />
      )}
    </div>
  );
}

// ─── Shared UI Primitives ─────────────────────────────────────────────────────

function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function ErrorMsg({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: "hsl(0 70% 60% / 0.12)", border: "1px solid hsl(0 70% 60% / 0.25)", borderRadius: 8, padding: "10px 14px", color: "hsl(0, 70%, 60%)", fontSize: 13 }}>
      {children}
    </div>
  );
}

const modalStyle: React.CSSProperties = {
  background: "var(--surface-card)",
  border: "1px solid var(--surface-border)",
  borderRadius: 16,
  padding: "28px 28px",
  width: "100%",
  maxWidth: 480,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "var(--surface-elevated)",
  border: "1px solid var(--surface-border)",
  borderRadius: 8,
  padding: "9px 12px",
  color: "var(--text-primary)",
  fontSize: 13,
  outline: "none",
  boxSizing: "border-box",
  appearance: "none",
};

const ghostBtn: React.CSSProperties = {
  padding: "9px 18px",
  borderRadius: 8,
  background: "var(--surface-elevated)",
  color: "var(--text-secondary)",
  border: "1px solid var(--surface-border)",
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 600,
};

const primaryBtn: React.CSSProperties = {
  padding: "9px 18px",
  borderRadius: 8,
  background: "var(--brand-gradient)",
  color: "white",
  border: "none",
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 700,
};
