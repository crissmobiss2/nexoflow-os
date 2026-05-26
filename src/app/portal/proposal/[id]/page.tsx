import { notFound } from "next/navigation";
import { db } from "@/server/db";
import { proposalVersions } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import ProposalSignClient from "./ProposalSignClient";

export default async function ProposalPortalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const proposal = await db.query.proposalVersions.findFirst({
    where: (t, { eq }) => eq(t.id, id),
    with: { lead: true },
  });

  if (!proposal) return notFound();

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0f", fontFamily: "Inter, system-ui, sans-serif" }}>
      {/* Header */}
      <div style={{ background: "#111118", borderBottom: "1px solid #1e1e2e", padding: "16px 32px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg, #7c5cbf, #a855f7)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#e2e8f0" }}>NexoFlow</div>
            <div style={{ fontSize: 10, color: "#555", letterSpacing: "0.08em", textTransform: "uppercase" }}>Proposal Review &amp; Sign</div>
          </div>
        </div>
        {proposal.signedAt && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#22c55e1a", border: "1px solid #22c55e33", borderRadius: 20, padding: "4px 12px" }}>
            <span style={{ color: "#22c55e", fontSize: 12 }}>✓</span>
            <span style={{ fontSize: 12, color: "#22c55e", fontWeight: 600 }}>Signed by {proposal.signerName}</span>
          </div>
        )}
      </div>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "32px 24px" }}>
        {/* Proposal HTML content */}
        <div
          style={{ background: "#fff", borderRadius: 14, padding: "48px 56px", marginBottom: 28, color: "#1a1a2e" }}
          dangerouslySetInnerHTML={{ __html: proposal.html }}
        />

        {/* E-sign section */}
        <ProposalSignClient
          proposalId={proposal.id}
          alreadySigned={!!proposal.signedAt}
          signerName={proposal.signerName ?? undefined}
          signerEmail={proposal.signerEmail ?? undefined}
          signedAt={proposal.signedAt ? proposal.signedAt.toISOString() : undefined}
          leadName={(proposal.lead as any)?.firstName ? `${(proposal.lead as any).firstName} ${(proposal.lead as any).lastName ?? ""}`.trim() : ((proposal.lead as any)?.company ?? "Client")}
        />
      </div>
    </div>
  );
}
