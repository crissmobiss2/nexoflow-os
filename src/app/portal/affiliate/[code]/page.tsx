import { notFound } from "next/navigation";
import { db } from "@/server/db";
import { affiliates, affiliateClicks, affiliateReferrals, affiliatePayouts, leads, leadCalls } from "@/server/db/schema";
import { eq, desc, and, sql, inArray } from "drizzle-orm";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function money(cents: number) {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}
function date(d: Date | string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// Elite (gold) = flat 20%; Standard = 10% on <$20k, 20% on $20k+
function commissionPct(tier: string, projectValueCents = 0): number {
  if (tier === "gold") return 20;
  return projectValueCents >= 2_000_000 ? 20 : 10;
}

function tierLabel(tier: string) {
  return tier === "gold" ? "Elite" : "Standard";
}

// ─── Journey Stage Config ─────────────────────────────────────────────────────

type Stage = "referred" | "call_booked" | "call_completed" | "deal_won" | "commission_paid";

function getStage(p: PipelineItem): Stage {
  if (p.referral?.status === "paid") return "commission_paid";
  if (p.lead.status === "won") return "deal_won";
  if (p.callCompletedAt) return "call_completed";
  if (p.callBookedAt) return "call_booked";
  return "referred";
}

const STAGE_CONFIG: Record<Stage, { label: string; color: string; bg: string; step: number }> = {
  referred:         { label: "Lead Referred",     color: "#60a5fa", bg: "#60a5fa1a", step: 1 },
  call_booked:      { label: "Call Booked",        color: "#a78bfa", bg: "#a78bfa1a", step: 2 },
  call_completed:   { label: "Call Completed",     color: "#f59e0b", bg: "#f59e0b1a", step: 3 },
  deal_won:         { label: "Deal Won",           color: "#22c55e", bg: "#22c55e1a", step: 4 },
  commission_paid:  { label: "Commission Paid",    color: "#34d399", bg: "#34d3991a", step: 5 },
};

const OUTCOME_LABEL: Record<string, string> = {
  won: "Won", lost: "Lost", no_show: "No Show",
  follow_up: "Follow Up", not_interested: "Not Interested", rescheduled: "Rescheduled",
};
const OUTCOME_COLOR: Record<string, string> = {
  won: "#22c55e", lost: "#ef4444", no_show: "#888",
  follow_up: "#f59e0b", not_interested: "#888", rescheduled: "#a78bfa",
};

type PipelineItem = {
  lead: { id: string; firstName: string | null; lastName: string | null; company: string | null; email: string | null; industry: string | null; status: string; wonValueCents: number | null; createdAt: Date };
  callBookedAt: Date | null;
  callCompletedAt: Date | null;
  callOutcome: string | null;
  callDurationMinutes: number | null;
  referral: typeof affiliateReferrals.$inferSelect | null;
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function AffiliatePortalPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;

  const affiliate = await db.query.affiliates.findFirst({
    where: eq(affiliates.referralCode, code),
  });
  if (!affiliate || affiliate.status !== "approved") return notFound();

  // All leads attributed to this affiliate
  const affiliateLeads = await db.query.leads.findMany({
    where: eq(leads.affiliateCode, code),
    orderBy: [desc(leads.createdAt)],
    columns: {
      id: true, firstName: true, lastName: true, email: true, company: true,
      industry: true, status: true, wonValueCents: true, createdAt: true,
    },
    with: {
      calls: {
        orderBy: [desc(leadCalls.createdAt)],
        columns: { id: true, scheduledAt: true, completedAt: true, outcome: true, durationMinutes: true },
      },
    },
  });

  // Commission referral records
  const leadIds = affiliateLeads.map((l) => l.id);
  const referralRecords = leadIds.length > 0
    ? await db.select().from(affiliateReferrals).where(
        and(eq(affiliateReferrals.affiliateId, affiliate.id), inArray(affiliateReferrals.leadId, leadIds)),
      )
    : [];
  const referralByLeadId = Object.fromEntries(referralRecords.map((r) => [r.leadId!, r]));

  // Click stats
  const [clickStats] = await db
    .select({
      total: sql<number>`COUNT(*)::int`,
      converted: sql<number>`SUM(CASE WHEN converted THEN 1 ELSE 0 END)::int`,
    })
    .from(affiliateClicks)
    .where(eq(affiliateClicks.affiliateId, affiliate.id));

  // Payouts
  const payoutRows = await db
    .select()
    .from(affiliatePayouts)
    .where(eq(affiliatePayouts.affiliateId, affiliate.id))
    .orderBy(desc(affiliatePayouts.createdAt));

  // Assemble pipeline
  const pipeline: PipelineItem[] = affiliateLeads.map((lead) => {
    const latestCall = (lead.calls as typeof leadCalls.$inferSelect[])[0] ?? null;
    return {
      lead,
      callBookedAt: latestCall?.scheduledAt ?? null,
      callCompletedAt: latestCall?.completedAt ?? null,
      callOutcome: latestCall?.outcome ?? null,
      callDurationMinutes: latestCall?.durationMinutes ?? null,
      referral: referralByLeadId[lead.id] ?? null,
    };
  });

  const summary = {
    clicks: clickStats?.total ?? 0,
    leads: pipeline.length,
    callsBooked: pipeline.filter((p) => p.callBookedAt).length,
    callsCompleted: pipeline.filter((p) => p.callCompletedAt).length,
    dealsWon: pipeline.filter((p) => p.lead.status === "won").length,
    pendingCents: referralRecords.filter((r) => r.status !== "paid").reduce((s, r) => s + (r.commissionCents ?? 0), 0),
    paidCents: affiliate.paidOutCents,
    totalEarnedCents: affiliate.totalEarningsCents,
  };

  const label = tierLabel(affiliate.tier);
  const tierColor = affiliate.tier === "gold" ? "#a78bfa" : "#60a5fa";
  const referralLink = `https://nexoflow.tech/ref/${affiliate.referralCode}`;
  const qualifierLink = `https://nexoflow.tech/qualifier?ref=${affiliate.referralCode}`;

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0f", color: "#e2e8f0", fontFamily: "Inter, system-ui, sans-serif", fontSize: 14 }}>

      {/* Header */}
      <div style={{ borderBottom: "1px solid #1e1e2e", padding: "20px 32px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 42, height: 42, borderRadius: 12, background: `linear-gradient(135deg, ${tierColor}, ${tierColor}99)`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 18, color: "#fff" }}>
            {affiliate.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>{affiliate.name}</div>
            <div style={{ fontSize: 12, color: "#555", marginTop: 1 }}>NexoFlow Affiliate Portal</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 11, fontWeight: 700, padding: "4px 12px", borderRadius: 20, background: `${tierColor}1a`, color: tierColor, border: `1px solid ${tierColor}33`, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            {label} tier
          </span>
        </div>
      </div>

      <div style={{ maxWidth: 960, margin: "0 auto", padding: "32px 24px" }}>

        {/* Referral Links */}
        <div style={{ background: "#111118", border: "1px solid #1e1e2e", borderRadius: 14, padding: "20px 24px", marginBottom: 28 }}>
          <div style={{ fontSize: 11, color: "#555", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 14 }}>Your Referral Links</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <div style={{ fontSize: 11, color: "#444", marginBottom: 6 }}>Main referral link</div>
              <code style={{ display: "block", fontSize: 13, color: "#a78bfa", background: "#0a0a0f", padding: "10px 14px", borderRadius: 8, border: "1px solid #1e1e2e", wordBreak: "break-all" }}>
                {referralLink}
              </code>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "#444", marginBottom: 6 }}>Lead qualifier (pre-qualify leads before you refer)</div>
              <code style={{ display: "block", fontSize: 13, color: "#7dd3fc", background: "#0a0a0f", padding: "10px 14px", borderRadius: 8, border: "1px solid #1e1e2e", wordBreak: "break-all" }}>
                {qualifierLink}
              </code>
            </div>
          </div>
          <div style={{ marginTop: 12, fontSize: 12, color: "#444" }}>
            Anyone who visits nexoflow.tech through your link is attributed to you for <strong style={{ color: "#666" }}>90 days</strong>.
            Payouts processed on the <strong style={{ color: "#666" }}>15th of each month</strong> ($50 minimum).
          </div>
        </div>

        {/* Commission rates */}
        <div style={{ background: "#111118", border: "1px solid #1e1e2e", borderRadius: 14, padding: "20px 24px", marginBottom: 28 }}>
          <div style={{ fontSize: 11, color: "#555", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 14 }}>Your Commission Rates</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div style={{ background: "#0a0a0f", borderRadius: 10, padding: "14px 16px", border: affiliate.tier !== "gold" ? "1px solid #60a5fa33" : "1px solid #1e1e2e" }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: "#60a5fa" }}>10%</div>
              <div style={{ fontSize: 13, color: "#e2e8f0", marginTop: 2 }}>Standard rate</div>
              <div style={{ fontSize: 11, color: "#555", marginTop: 2 }}>$10k – $20k projects</div>
            </div>
            <div style={{ background: "#0a0a0f", borderRadius: 10, padding: "14px 16px", border: "1px solid #a78bfa33" }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: "#a78bfa" }}>20%</div>
              <div style={{ fontSize: 13, color: "#e2e8f0", marginTop: 2 }}>{affiliate.tier === "gold" ? "Elite rate (your tier)" : "Elite rate"}</div>
              <div style={{ fontSize: 11, color: "#555", marginTop: 2 }}>{affiliate.tier === "gold" ? "All projects — permanent" : "$20k+ projects"}</div>
            </div>
          </div>
          {affiliate.tier !== "gold" && (
            <div style={{ marginTop: 12, fontSize: 12, color: "#555", lineHeight: 1.6 }}>
              Refer <strong style={{ color: "#e2e8f0" }}>3+ clients within 6 months</strong> to unlock the Elite tier and earn 20% permanently on all projects.
            </div>
          )}
        </div>

        {/* Pipeline Progress Bar */}
        <div style={{ background: "#111118", border: "1px solid #1e1e2e", borderRadius: 14, padding: "20px 24px", marginBottom: 28 }}>
          <div style={{ fontSize: 11, color: "#555", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 16 }}>Your Pipeline</div>
          <div style={{ display: "flex", gap: 0 }}>
            {[
              { label: "Clicks",        value: summary.clicks,         color: "#60a5fa" },
              { label: "Leads",         value: summary.leads,          color: "#818cf8" },
              { label: "Calls Booked",  value: summary.callsBooked,    color: "#a78bfa" },
              { label: "Calls Done",    value: summary.callsCompleted, color: "#c084fc" },
              { label: "Deals Won",     value: summary.dealsWon,       color: "#22c55e" },
            ].map((step, i, arr) => (
              <div key={step.label} style={{ flex: 1, textAlign: "center", position: "relative" }}>
                {i < arr.length - 1 && (
                  <div style={{ position: "absolute", top: 20, right: 0, width: "50%", height: 2, background: "#1e1e2e", zIndex: 0 }} />
                )}
                {i > 0 && (
                  <div style={{ position: "absolute", top: 20, left: 0, width: "50%", height: 2, background: "#1e1e2e", zIndex: 0 }} />
                )}
                <div style={{ position: "relative", zIndex: 1, width: 40, height: 40, borderRadius: "50%", background: `${step.color}1a`, border: `2px solid ${step.color}`, margin: "0 auto 10px", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 15, color: step.color }}>
                  {step.value}
                </div>
                <div style={{ fontSize: 11, color: "#555" }}>{step.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Stats Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 28 }}>
          {[
            { label: "Pending Commissions", value: money(summary.pendingCents), color: "#f59e0b", sub: "awaiting payout" },
            { label: "Total Paid Out",      value: money(summary.paidCents),    color: "#22c55e", sub: "paid to date" },
            { label: "Total Earned",        value: money(summary.totalEarnedCents), color: tierColor, sub: "lifetime earnings" },
          ].map((s) => (
            <div key={s.label} style={{ background: "#111118", border: "1px solid #1e1e2e", borderRadius: 14, padding: "18px 20px" }}>
              <div style={{ fontSize: 11, color: "#555", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>{s.label}</div>
              <div style={{ fontSize: 26, fontWeight: 700, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 11, color: "#444", marginTop: 4 }}>{s.sub}</div>
            </div>
          ))}
        </div>

        {/* Bonus Programs */}
        <div style={{ background: "#111118", border: "1px solid #1e1e2e", borderRadius: 14, padding: "20px 24px", marginBottom: 28 }}>
          <div style={{ fontSize: 11, color: "#555", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 14 }}>Bonus Programs</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
            {[
              { icon: "🔄", title: "Recurring Commissions", desc: "Earn 5–10% on retainer & maintenance contracts for 12 full months — passive income after the initial deal." },
              { icon: "⚡", title: "Tier Escalation Bonus", desc: "Refer 3+ clients within 6 months → permanent 20% rate unlocked on all future projects." },
              { icon: "👥", title: "Affiliate Referral Bonus", desc: "Refer another affiliate who closes their first sale → earn $500–$1,000 bonus." },
              { icon: "🏆", title: "Top Performer Bonus", desc: "High-volume affiliates earn an extra $1,000 bonus or luxury experience — ask your manager for details." },
            ].map((b) => (
              <div key={b.title} style={{ background: "#0a0a0f", borderRadius: 10, padding: "14px 16px", border: "1px solid #1e1e2e" }}>
                <div style={{ fontSize: 20, marginBottom: 8 }}>{b.icon}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#e2e8f0", marginBottom: 4 }}>{b.title}</div>
                <div style={{ fontSize: 12, color: "#555", lineHeight: 1.5 }}>{b.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Lead Pipeline Table */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 11, color: "#555", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 14 }}>Referral Pipeline</div>

          {pipeline.length === 0 ? (
            <div style={{ background: "#111118", border: "1px solid #1e1e2e", borderRadius: 14, padding: 40, textAlign: "center", color: "#444" }}>
              No leads yet. Share your referral link to get started.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {pipeline.map((item) => {
                const stage = getStage(item);
                const stageCfg = STAGE_CONFIG[stage];
                const name = [item.lead.firstName, item.lead.lastName].filter(Boolean).join(" ") || item.lead.company || item.lead.email || "Unknown";
                const itemPct = commissionPct(affiliate.tier, item.lead.wonValueCents ?? 0);

                return (
                  <div key={item.lead.id} style={{ background: "#111118", border: "1px solid #1e1e2e", borderRadius: 14, padding: "16px 20px" }}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>

                      {/* Lead info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                          <div style={{ width: 32, height: 32, borderRadius: 8, background: `${stageCfg.color}1a`, border: `1px solid ${stageCfg.color}33`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 13, color: stageCfg.color, flexShrink: 0 }}>
                            {name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 14, color: "#e2e8f0" }}>{name}</div>
                            {item.lead.company && item.lead.company !== name && (
                              <div style={{ fontSize: 12, color: "#555", marginTop: 1 }}>{item.lead.company}</div>
                            )}
                          </div>
                          <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: stageCfg.bg, color: stageCfg.color, border: `1px solid ${stageCfg.color}33`, textTransform: "uppercase", letterSpacing: "0.05em", flexShrink: 0 }}>
                            {stageCfg.label}
                          </span>
                        </div>

                        {/* Journey steps */}
                        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginLeft: 42 }}>
                          <JourneyStep icon="👤" label="Referred" value={date(item.lead.createdAt)} done />
                          <JourneyStep icon="📅" label="Call Booked" value={date(item.callBookedAt)} done={!!item.callBookedAt} />
                          <JourneyStep
                            icon="📞"
                            label="Call Outcome"
                            value={item.callOutcome ? `${OUTCOME_LABEL[item.callOutcome] ?? item.callOutcome}${item.callDurationMinutes ? ` · ${item.callDurationMinutes}m` : ""}` : "—"}
                            done={!!item.callOutcome}
                            color={item.callOutcome ? OUTCOME_COLOR[item.callOutcome] : undefined}
                          />
                          <JourneyStep
                            icon="🏆"
                            label="Deal Value"
                            value={item.lead.wonValueCents ? money(item.lead.wonValueCents) : "—"}
                            done={!!item.lead.wonValueCents}
                            color={item.lead.wonValueCents ? "#22c55e" : undefined}
                          />
                        </div>
                      </div>

                      {/* Commission */}
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        {item.referral ? (
                          <>
                            <div style={{ fontSize: 18, fontWeight: 700, color: item.referral.status === "paid" ? "#22c55e" : "#f59e0b" }}>
                              {money(item.referral.commissionCents ?? 0)}
                            </div>
                            <div style={{ fontSize: 11, color: "#444", marginTop: 2 }}>
                              {item.referral.commissionPct}% commission
                            </div>
                            <div style={{ fontSize: 10, fontWeight: 600, marginTop: 4, color: item.referral.status === "paid" ? "#22c55e" : "#f59e0b", textTransform: "uppercase" }}>
                              {item.referral.status}
                            </div>
                          </>
                        ) : item.lead.status === "won" ? (
                          <div style={{ fontSize: 12, color: "#f59e0b" }}>Pending logging<br /><span style={{ color: "#555", fontSize: 11 }}>est. {itemPct}%</span></div>
                        ) : (
                          <div style={{ fontSize: 12, color: "#333" }}>—</div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Payout History */}
        {payoutRows.length > 0 && (
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 11, color: "#555", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 14 }}>Payout History</div>
            <div style={{ background: "#111118", border: "1px solid #1e1e2e", borderRadius: 14, overflow: "hidden" }}>
              {payoutRows.map((payout, i) => (
                <div key={payout.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", borderBottom: i < payoutRows.length - 1 ? "1px solid #1a1a28" : "none" }}>
                  <div>
                    <div style={{ fontWeight: 600, color: "#e2e8f0" }}>{money(payout.amountCents)}</div>
                    <div style={{ fontSize: 12, color: "#555", marginTop: 2 }}>{payout.method.replace("_", " ")} · {date(payout.completedAt ?? payout.createdAt)}</div>
                    {payout.reference && <div style={{ fontSize: 11, color: "#444", marginTop: 2 }}>Ref: {payout.reference}</div>}
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: payout.status === "completed" ? "#22c55e1a" : "#f59e0b1a", color: payout.status === "completed" ? "#22c55e" : "#f59e0b", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    {payout.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ textAlign: "center", color: "#333", fontSize: 12, paddingTop: 16, borderTop: "1px solid #111" }}>
          Questions? Email <span style={{ color: "#a78bfa" }}>team@nexoflow.tech</span>
        </div>
      </div>
    </div>
  );
}

function JourneyStep({ icon, label, value, done, color }: {
  icon: string; label: string; value: string; done: boolean; color?: string;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
      <span style={{ fontSize: 12 }}>{icon}</span>
      <span style={{ fontSize: 11, color: "#444" }}>{label}:</span>
      <span style={{ fontSize: 11, fontWeight: 600, color: color ?? (done ? "#e2e8f0" : "#333") }}>{value}</span>
    </div>
  );
}
