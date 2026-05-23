import { notFound } from "next/navigation";
import { db } from "@/server/db";
import { clients, invoices, projects } from "@/server/db/schema";
import { eq } from "drizzle-orm";

export default async function ClientPortalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const client = await db.query.clients.findFirst({
    where: (t, { and, eq }) => and(eq(t.portalToken, token), eq(t.portalEnabled, true)),
  });
  if (!client) return notFound();

  const [clientInvoices, clientProjects] = await Promise.all([
    db.select().from(invoices).where(eq(invoices.clientId, client.id)).limit(20),
    db.select().from(projects).where(eq(projects.clientId, client.id)).limit(10),
  ]);

  const totalPaid = clientInvoices.filter((i) => i.status === "paid").reduce((s, i) => s + i.total, 0);
  const totalDue = clientInvoices.filter((i) => i.status === "sent" || i.status === "overdue").reduce((s, i) => s + i.total, 0);

  const STATUS_COLOR: Record<string, string> = {
    draft: "#888", sent: "#60a5fa", paid: "#22c55e", overdue: "#ef4444", cancelled: "#666",
  };
  const PROJECT_STATUS_COLOR: Record<string, string> = {
    brief: "#888", scored: "#60a5fa", scoped: "#a78bfa", architected: "#f59e0b",
    generating: "#22c55e", ready: "#16a34a", archived: "#666",
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0f0f14", color: "#e2e8f0", fontFamily: "Inter, sans-serif" }}>
      {/* Header */}
      <div style={{ background: "#1a1a2e", borderBottom: "1px solid #2d2d44", padding: "20px 32px", display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{ width: 40, height: 40, borderRadius: "50%", background: "linear-gradient(135deg, #7c5cbf, #a855f7)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 16 }}>
          {client.name.charAt(0).toUpperCase()}
        </div>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{client.name}</div>
          <div style={{ fontSize: 13, color: "#888" }}>Client Portal · NexoFlow</div>
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "32px 24px" }}>
        {/* Metrics */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 32 }}>
          {[
            { label: "Total Paid", value: `$${(totalPaid / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}`, color: "#22c55e" },
            { label: "Outstanding", value: `$${(totalDue / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}`, color: "#f59e0b" },
            { label: "Active Projects", value: String(clientProjects.filter((p) => p.status !== "archived").length), color: "#60a5fa" },
          ].map((m) => (
            <div key={m.label} style={{ background: "#1a1a2e", border: "1px solid #2d2d44", borderRadius: 12, padding: "20px 24px" }}>
              <div style={{ fontSize: 12, color: "#888", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>{m.label}</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: m.color }}>{m.value}</div>
            </div>
          ))}
        </div>

        {/* Projects */}
        {clientProjects.length > 0 && (
          <div style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 14, fontWeight: 600, color: "#888", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 16 }}>Projects</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {clientProjects.map((p) => (
                <div key={p.id} style={{ background: "#1a1a2e", border: "1px solid #2d2d44", borderRadius: 12, padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>{p.name}</div>
                    <div style={{ fontSize: 13, color: "#888" }}>{p.projectType.replace(/_/g, " ")}</div>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 600, padding: "4px 12px", borderRadius: 20, background: `${PROJECT_STATUS_COLOR[p.status] ?? "#888"}22`, color: PROJECT_STATUS_COLOR[p.status] ?? "#888", border: `1px solid ${PROJECT_STATUS_COLOR[p.status] ?? "#888"}44`, textTransform: "capitalize" }}>
                    {p.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Invoices */}
        <div>
          <h2 style={{ fontSize: 14, fontWeight: 600, color: "#888", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 16 }}>Invoices</h2>
          {clientInvoices.length === 0 ? (
            <div style={{ background: "#1a1a2e", border: "1px solid #2d2d44", borderRadius: 12, padding: 32, textAlign: "center", color: "#666" }}>No invoices yet</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {clientInvoices.map((inv) => (
                <div key={inv.id} style={{ background: "#1a1a2e", border: "1px solid #2d2d44", borderRadius: 12, padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ fontWeight: 600, marginBottom: 2 }}>{inv.invoiceNumber}</div>
                    {inv.dueDate && <div style={{ fontSize: 12, color: "#888" }}>Due {new Date(inv.dueDate).toLocaleDateString("en-US")}</div>}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                    <div style={{ fontWeight: 700, fontSize: 16 }}>${(inv.total / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}</div>
                    <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 20, background: `${STATUS_COLOR[inv.status] ?? "#888"}22`, color: STATUS_COLOR[inv.status] ?? "#888", border: `1px solid ${STATUS_COLOR[inv.status] ?? "#888"}44`, textTransform: "capitalize" }}>
                      {inv.status}
                    </span>
                    {inv.stripePaymentUrl && inv.status !== "paid" && (
                      <a href={inv.stripePaymentUrl} target="_blank" rel="noreferrer" style={{ fontSize: 12, padding: "6px 14px", borderRadius: 8, background: "linear-gradient(135deg, #7c5cbf, #a855f7)", color: "#fff", textDecoration: "none", fontWeight: 600 }}>
                        Pay Now
                      </a>
                    )}
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
