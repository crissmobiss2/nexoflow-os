"use client";

import { useState } from "react";
import { api } from "@/lib/trpc/client";
import {
  Users, CheckCircle2, XCircle, Clock, DollarSign, TrendingUp,
  Link2, Copy, ChevronDown, Loader2, Star, Award, Zap,
} from "lucide-react";

const TIER_CONFIG = {
  base:   { label: "Base 10%",   color: "hsl(220, 70%, 60%)",  bg: "hsl(220, 70%, 60%, 0.12)",  icon: Zap },
  silver: { label: "Silver 12%", color: "hsl(220, 14%, 65%)",  bg: "hsl(220, 14%, 65%, 0.12)",  icon: Star },
  gold:   { label: "Gold 15%",   color: "hsl(40, 90%, 58%)",   bg: "hsl(40, 90%, 58%, 0.12)",   icon: Award },
};

const STATUS_CONFIG = {
  pending:   { label: "Pending",   color: "hsl(35, 90%, 60%)",  bg: "hsl(35, 90%, 60%, 0.12)"  },
  approved:  { label: "Approved",  color: "hsl(142, 68%, 52%)", bg: "hsl(142, 68%, 52%, 0.12)" },
  rejected:  { label: "Rejected",  color: "hsl(0, 70%, 60%)",   bg: "hsl(0, 70%, 60%, 0.12)"   },
  suspended: { label: "Suspended", color: "hsl(220, 14%, 55%)", bg: "hsl(220, 14%, 55%, 0.1)"  },
};

function cents(n: number) {
  return `$${(n / 100).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export default function AffiliatesPage() {
  const [filterStatus, setFilterStatus] = useState<string | undefined>(undefined);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const { data: affiliates = [], isLoading, refetch } = api.affiliates.list.useQuery(
    filterStatus ? { status: filterStatus as any } : undefined,
  );
  const { data: stats } = api.affiliates.stats.useQuery();

  const approveMutation = api.affiliates.approve.useMutation({ onSuccess: () => void refetch() });
  const rejectMutation = api.affiliates.reject.useMutation({ onSuccess: () => void refetch() });
  const updateMutation = api.affiliates.update.useMutation({ onSuccess: () => void refetch() });

  function copyCode(code: string) {
    void navigator.clipboard.writeText(`https://nexoflow.tech/ref/${code}`);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
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
            Manage partners, track referrals, and handle commission payouts
          </p>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Total Affiliates", value: stats.total, sub: `${stats.pending} pending`, icon: Users, color: "hsl(220, 90%, 62%)" },
            { label: "Active Partners", value: stats.approved, sub: "approved", icon: CheckCircle2, color: "hsl(142, 68%, 52%)" },
            { label: "Total Referrals", value: stats.totalReferrals, sub: `${stats.converted} converted`, icon: TrendingUp, color: "hsl(262, 83%, 68%)" },
            { label: "Total Earned", value: cents(stats.totalEarningsCents), sub: `${cents(stats.paidOutCents)} paid out`, icon: DollarSign, color: "hsl(40, 90%, 58%)" },
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
        {[undefined, "pending", "approved", "rejected"].map((s) => {
          const cfg = s ? STATUS_CONFIG[s as keyof typeof STATUS_CONFIG] : null;
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
              {s ? STATUS_CONFIG[s as keyof typeof STATUS_CONFIG].label : `All (${affiliates.length})`}
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
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>Applications submitted at nexoflow.tech/affiliates will appear here.</p>
        </div>
      ) : (
        <div className="rounded-2xl overflow-hidden" style={{ background: "var(--surface-card)", border: "1px solid var(--surface-border)" }}>
          {/* Table header */}
          <div className="grid px-6 py-3 text-[11px] font-semibold uppercase tracking-wider"
            style={{ borderBottom: "1px solid var(--surface-border)", color: "var(--text-muted)", gridTemplateColumns: "2fr 1.5fr 100px 80px 120px 140px" }}>
            {["Affiliate", "Promo Method", "Tier", "Refs", "Earned", "Actions"].map((h) => (
              <div key={h}>{h}</div>
            ))}
          </div>

          {affiliates.map((aff) => {
            const tierCfg = TIER_CONFIG[aff.tier];
            const statusCfg = STATUS_CONFIG[aff.status];
            const TierIcon = tierCfg.icon;

            return (
              <div key={aff.id} className="grid items-center px-6 py-4"
                style={{ borderBottom: "1px solid var(--surface-border-subtle)", gridTemplateColumns: "2fr 1.5fr 100px 80px 120px 140px" }}>

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
                        onClick={() => copyCode(aff.referralCode)}
                        className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded hover:opacity-70 transition-opacity"
                        style={{ color: copiedCode === aff.referralCode ? "hsl(142, 68%, 52%)" : "var(--text-muted)" }}
                        title="Copy referral link"
                      >
                        {copiedCode === aff.referralCode ? <CheckCircle2 className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        /ref/{aff.referralCode}
                      </button>
                    )}
                  </div>
                </div>

                {/* Promo method */}
                <div className="text-xs" style={{ color: "var(--text-secondary)" }}>
                  {aff.promoMethod ?? "—"}
                </div>

                {/* Tier */}
                <div>
                  <span className="flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-full w-fit"
                    style={{ background: tierCfg.bg, color: tierCfg.color }}>
                    <TierIcon className="w-3 h-3" />{tierCfg.label}
                  </span>
                </div>

                {/* Refs */}
                <div className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                  {aff.totalReferrals}
                </div>

                {/* Earned */}
                <div>
                  <div className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{cents(aff.totalEarningsCents)}</div>
                  <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>{cents(aff.paidOutCents)} paid</div>
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
                    <select
                      value={aff.tier}
                      onChange={(e) => updateMutation.mutate({ id: aff.id, tier: e.target.value as any })}
                      className="text-[11px] px-2 py-1.5 rounded-lg font-semibold"
                      style={{ background: "var(--surface-elevated)", color: "var(--text-secondary)", border: "1px solid var(--surface-border)" }}
                    >
                      <option value="base">Base 10%</option>
                      <option value="silver">Silver 12%</option>
                      <option value="gold">Gold 15%</option>
                    </select>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
