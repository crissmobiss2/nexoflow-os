import { notFound } from "next/navigation";
import { db } from "@/server/db";
import { affiliates, affiliateReferrals } from "@/server/db/schema";
import { eq } from "drizzle-orm";

export default async function AffiliatePortalPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;

  const affiliate = await db.query.affiliates.findFirst({
    where: eq(affiliates.referralCode, code),
    with: { referrals: true },
  });
  if (!affiliate || affiliate.status !== "approved") return notFound();

  const referrals = affiliate.referrals ?? [];
  const pendingCount = referrals.filter((r) => r.status === "pending").length;
  const convertedCount = referrals.filter((r) => r.status === "converted" || r.status === "paid").length;
  const paidOut = affiliate.paidOutCents;
  const pending = affiliate.totalEarningsCents - paidOut;
  const conversionRate = referrals.length > 0 ? Math.round((convertedCount / referrals.length) * 100) : 0;

  const TIER_COLOR: Record<string, string> = { base: "#888", silver: "#94a3b8", gold: "#f59e0b" };
  const TIER_LABEL: Record<string, string> = { base: "Base (10%)", silver: "Silver (15%)", gold: "Gold (20%)" };
  const REF_STATUS_COLOR: Record<string, string> = { pending: "#f59e0b", converted: "#22c55e", paid: "#60a5fa", cancelled: "#888" };
  const referralLink = `https://nexoflow.tech/?ref=${affiliate.referralCode}`;

  return (
    <div style={{ minHeight: "100vh", background: "#0f0f14", color: "#e2e8f0", fontFamily: "Inter, sans-serif" }}>
      {/* Header */}
      <div style={{ background: "#1a1a2e", borderBottom: "1px solid #2d2d44", padding: "20px 32px" }}>
        <div style={{ maxWidth: 900, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ width: 40, height: 40, borderRadius: "50%", background: "linear-gradient(135deg, #f59e0b, #f97316)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 16 }}>
              {affiliate.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{affiliate.name}</div>
              <div style={{ fontSize: 13, color: "#888" }}>Affiliate Dashboard · NexoFlow</div>
            </div>
          </div>
          <span style={{ fontSize: 12, fontWeight: 700, padding: "4px 14px", borderRadius: 20, background: `${TIER_COLOR[affiliate.tier] ?? "#888"}22`, color: TIER_COLOR[affiliate.tier] ?? "#888", border: `1px solid ${TIER_COLOR[affiliate.tier] ?? "#888"}44`, textTransform: "uppercase" }}>
            {TIER_LABEL[affiliate.tier] ?? affiliate.tier}
          </span>
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "32px 24px" }}>
        {/* Referral Link */}
        <div style={{ background: "#1a1a2e", border: "1px solid #7c5cbf44", borderRadius: 12, padding: "20px 24px", marginBottom: 24 }}>
          <div style={{ fontSize: 12, color: "#888", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>Your Referral Link</div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <code style={{ fontSize: 14, color: "#a78bfa", background: "#0f0f14", padding: "8px 14px", borderRadius: 8, flex: 1, minWidth: 200 }}>{referralLink}</code>
            <a href={`data:text/plain,${encodeURIComponent(referralLink)}`} download="referral-link.txt" style={{ fontSize: 13, padding: "8px 16px", borderRadius: 8, background: "linear-gradient(135deg, #7c5cbf, #a855f7)", color: "#fff", textDecoration: "none", fontWeight: 600, whiteSpace: "nowrap" }}>
              Copy Link
            </a>
          </div>
        </div>

        {/* Metrics */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16, marginBottom: 32 }}>
          {[
            { label: "Total Referrals", value: String(affiliate.totalReferrals), color: "#60a5fa" },
            { label: "Conversion Rate", value: `${conversionRate}%`, color: "#a78bfa" },
            { label: "Earnings Pending", value: `$${(pending / 100).toFixed(2)}`, color: "#f59e0b" },
            { label: "Total Paid Out", value: `$${(paidOut / 100).toFixed(2)}`, color: "#22c55e" },
          ].map((m) => (
            <div key={m.label} style={{ background: "#1a1a2e", border: "1px solid #2d2d44", borderRadius: 12, padding: "20px 24px" }}>
              <div style={{ fontSize: 12, color: "#888", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>{m.label}</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: m.color }}>{m.value}</div>
            </div>
          ))}
        </div>

        {/* Tier Progress */}
        <div style={{ background: "#1a1a2e", border: "1px solid #2d2d44", borderRadius: 12, padding: "20px 24px", marginBottom: 32 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Commission Tier Progress</div>
          <div style={{ display: "flex", gap: 8 }}>
            {[
              { tier: "base", label: "Base", target: 0, pct: "10%" },
              { tier: "silver", label: "Silver", target: 5, pct: "15%" },
              { tier: "gold", label: "Gold", target: 20, pct: "20%" },
            ].map((t) => (
              <div key={t.tier} style={{ flex: 1, padding: "12px 16px", borderRadius: 8, background: affiliate.tier === t.tier ? `${TIER_COLOR[t.tier]}22` : "#0f0f14", border: `1px solid ${affiliate.tier === t.tier ? TIER_COLOR[t.tier] : "#333"}`, textAlign: "center" }}>
                <div style={{ fontSize: 11, color: TIER_COLOR[t.tier], fontWeight: 700, textTransform: "uppercase" }}>{t.label}</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: TIER_COLOR[t.tier], marginTop: 4 }}>{t.pct}</div>
                <div style={{ fontSize: 11, color: "#666", marginTop: 2 }}>{t.target === 0 ? "Default" : `${t.target}+ referrals`}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Referral History */}
        <div>
          <h2 style={{ fontSize: 14, fontWeight: 600, color: "#888", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 16 }}>Referral History</h2>
          {referrals.length === 0 ? (
            <div style={{ background: "#1a1a2e", border: "1px solid #2d2d44", borderRadius: 12, padding: 32, textAlign: "center", color: "#666" }}>No referrals yet. Share your link to get started!</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {referrals.map((r) => (
                <div key={r.id} style={{ background: "#1a1a2e", border: "1px solid #2d2d44", borderRadius: 12, padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ fontSize: 13, color: "#888" }}>{new Date(r.createdAt).toLocaleDateString("en-US")}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                    {r.commissionCents ? <div style={{ fontWeight: 700 }}>${(r.commissionCents / 100).toFixed(2)}</div> : null}
                    <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 20, background: `${REF_STATUS_COLOR[r.status] ?? "#888"}22`, color: REF_STATUS_COLOR[r.status] ?? "#888", border: `1px solid ${REF_STATUS_COLOR[r.status] ?? "#888"}44`, textTransform: "capitalize" }}>
                      {r.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ marginTop: 48, textAlign: "center", color: "#444", fontSize: 12 }}>
          Powered by <strong style={{ color: "#7c5cbf" }}>NexoFlow</strong>
        </div>
      </div>
    </div>
  );
}
