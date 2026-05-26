import { notFound } from "next/navigation";
import { db } from "@/server/db";
import { clients, invoices, projects, sprintTasks, clientMessages } from "@/server/db/schema";
import { eq, desc, asc } from "drizzle-orm";
import ClientPortalMessaging from "./ClientPortalMessaging";

const STATUS_COLOR: Record<string, string> = {
  draft: "#888", sent: "#60a5fa", paid: "#22c55e", overdue: "#ef4444", cancelled: "#666",
};
const PROJECT_STATUS_COLOR: Record<string, string> = {
  brief: "#888", scored: "#60a5fa", scoped: "#a78bfa", architected: "#f59e0b",
  generating: "#22c55e", ready: "#16a34a", archived: "#666",
};
const TASK_STATUS_COLOR: Record<string, string> = {
  backlog: "#555", todo: "#60a5fa", in_progress: "#f59e0b", review: "#a78bfa", done: "#22c55e", cancelled: "#555",
};

function money(cents: number) {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
}

export default async function ClientPortalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const client = await db.query.clients.findFirst({
    where: (t, { and, eq }) => and(eq(t.portalToken, token), eq(t.portalEnabled, true)),
  });
  if (!client) return notFound();

  const [clientInvoices, clientProjects, messages] = await Promise.all([
    db.select().from(invoices).where(eq(invoices.clientId, client.id)).orderBy(desc(invoices.createdAt)).limit(20),
    db.select().from(projects).where(eq(projects.clientId, client.id)).orderBy(desc(projects.createdAt)).limit(10),
    db.select().from(clientMessages).where(eq(clientMessages.clientId, client.id)).orderBy(asc(clientMessages.createdAt)).limit(50),
  ]);

  // Sprint tasks for client's projects
  const projectIds = clientProjects.map((p) => p.id);
  const tasks = projectIds.length > 0
    ? await db.select().from(sprintTasks)
        .where(eq(sprintTasks.projectId, projectIds[0]!))
        .orderBy(asc(sprintTasks.orderVal))
        .limit(30)
    : [];

  const totalPaid = clientInvoices.filter((i) => i.status === "paid").reduce((s, i) => s + i.total, 0);
  const totalDue = clientInvoices.filter((i) => i.status === "sent" || i.status === "overdue").reduce((s, i) => s + i.total, 0);
  const activeProjects = clientProjects.filter((p) => p.status !== "archived").length;

  // Milestone progress across active projects
  const milestones = [
    { label: "Discovery & Brief", done: clientProjects.some((p) => ["scored", "scoped", "architected", "generating", "ready"].includes(p.status)) },
    { label: "Scope & Architecture", done: clientProjects.some((p) => ["architected", "generating", "ready"].includes(p.status)) },
    { label: "Build & Development", done: clientProjects.some((p) => ["generating", "ready"].includes(p.status)) },
    { label: "Delivery & Launch", done: clientProjects.some((p) => p.status === "ready") },
  ];

  const taskGroups: Record<string, typeof tasks> = {};
  for (const t of tasks) {
    if (!taskGroups[t.status]) taskGroups[t.status] = [];
    taskGroups[t.status]!.push(t);
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0f", color: "#e2e8f0", fontFamily: "Inter, system-ui, sans-serif" }}>
      {/* Header */}
      <div style={{ background: "#111118", borderBottom: "1px solid #1e1e2e", padding: "20px 32px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 42, height: 42, borderRadius: "50%", background: "linear-gradient(135deg, #7c5cbf, #a855f7)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 18, color: "#fff" }}>
            {client.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{client.name}</div>
            <div style={{ fontSize: 12, color: "#555" }}>Client Portal · Powered by NexoFlow</div>
          </div>
        </div>
        <div style={{ fontSize: 12, color: "#444" }}>Need help? <span style={{ color: "#a78bfa" }}>team@nexoflow.tech</span></div>
      </div>

      <div style={{ maxWidth: 960, margin: "0 auto", padding: "32px 24px" }}>
        {/* Metrics */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 32 }}>
          {[
            { label: "Total Paid", value: money(totalPaid), color: "#22c55e" },
            { label: "Outstanding", value: money(totalDue), color: "#f59e0b" },
            { label: "Active Projects", value: String(activeProjects), color: "#60a5fa" },
          ].map((m) => (
            <div key={m.label} style={{ background: "#111118", border: "1px solid #1e1e2e", borderRadius: 14, padding: "20px 24px" }}>
              <div style={{ fontSize: 11, color: "#555", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>{m.label}</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: m.color }}>{m.value}</div>
            </div>
          ))}
        </div>

        {/* Milestone Timeline */}
        <div style={{ background: "#111118", border: "1px solid #1e1e2e", borderRadius: 14, padding: "20px 24px", marginBottom: 28 }}>
          <div style={{ fontSize: 11, color: "#555", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 18 }}>Project Milestone Progress</div>
          <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
            {milestones.map((m, i) => (
              <div key={m.label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", position: "relative" }}>
                {i > 0 && <div style={{ position: "absolute", left: 0, top: 16, width: "50%", height: 2, background: milestones[i - 1]!.done ? "#a78bfa" : "#1e1e2e" }} />}
                {i < milestones.length - 1 && <div style={{ position: "absolute", right: 0, top: 16, width: "50%", height: 2, background: m.done ? "#a78bfa" : "#1e1e2e" }} />}
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: m.done ? "#a78bfa1a" : "#1e1e2e", border: `2px solid ${m.done ? "#a78bfa" : "#1e1e2e"}`, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1, marginBottom: 8 }}>
                  {m.done ? <span style={{ color: "#a78bfa", fontSize: 14 }}>✓</span> : <span style={{ color: "#333", fontSize: 10 }}>{i + 1}</span>}
                </div>
                <div style={{ fontSize: 11, color: m.done ? "#e2e8f0" : "#444", textAlign: "center", lineHeight: 1.3 }}>{m.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Projects */}
        {clientProjects.length > 0 && (
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 11, color: "#555", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 14 }}>Your Projects</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {clientProjects.map((p) => (
                <div key={p.id} style={{ background: "#111118", border: "1px solid #1e1e2e", borderRadius: 14, padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14, color: "#e2e8f0", marginBottom: 4 }}>{p.name}</div>
                    <div style={{ fontSize: 12, color: "#555" }}>{p.projectType.replace(/_/g, " ")}</div>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: "4px 12px", borderRadius: 20, background: `${PROJECT_STATUS_COLOR[p.status] ?? "#888"}22`, color: PROJECT_STATUS_COLOR[p.status] ?? "#888", border: `1px solid ${PROJECT_STATUS_COLOR[p.status] ?? "#888"}44`, textTransform: "capitalize" }}>
                    {p.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Sprint Tasks (for first project) */}
        {tasks.length > 0 && (
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 11, color: "#555", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 14 }}>Active Sprint Tasks</div>
            <div style={{ background: "#111118", border: "1px solid #1e1e2e", borderRadius: 14, overflow: "hidden" }}>
              {["in_progress", "todo", "review", "done"].flatMap((status) =>
                (taskGroups[status] ?? []).slice(0, 5).map((task) => (
                  <div key={task.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 20px", borderBottom: "1px solid #111" }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: TASK_STATUS_COLOR[task.status] ?? "#555", flexShrink: 0 }} />
                    <div style={{ flex: 1, fontSize: 13, color: "#e2e8f0" }}>{task.title}</div>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 10, background: `${TASK_STATUS_COLOR[task.status] ?? "#555"}1a`, color: TASK_STATUS_COLOR[task.status] ?? "#555", textTransform: "uppercase" }}>
                      {task.status.replace("_", " ")}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Invoices */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 11, color: "#555", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 14 }}>Invoices</div>
          {clientInvoices.length === 0 ? (
            <div style={{ background: "#111118", border: "1px solid #1e1e2e", borderRadius: 14, padding: 32, textAlign: "center", color: "#444" }}>No invoices yet.</div>
          ) : (
            <div style={{ background: "#111118", border: "1px solid #1e1e2e", borderRadius: 14, overflow: "hidden" }}>
              {clientInvoices.map((inv, i) => (
                <div key={inv.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", borderBottom: i < clientInvoices.length - 1 ? "1px solid #111" : "none" }}>
                  <div>
                    <div style={{ fontWeight: 600, color: "#e2e8f0", fontSize: 14 }}>{inv.invoiceNumber}</div>
                    <div style={{ fontSize: 12, color: "#555", marginTop: 2 }}>
                      {inv.dueDate ? `Due ${new Date(inv.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}` : "No due date"}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontWeight: 700, fontSize: 15, color: "#e2e8f0" }}>{money(inv.total)}</div>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 10, background: `${STATUS_COLOR[inv.status] ?? "#888"}1a`, color: STATUS_COLOR[inv.status] ?? "#888", textTransform: "uppercase", marginTop: 4, display: "inline-block" }}>
                      {inv.status}
                    </span>
                    {inv.stripePaymentUrl && inv.status !== "paid" && (
                      <div style={{ marginTop: 6 }}>
                        <a href={inv.stripePaymentUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: "#a78bfa", textDecoration: "none", fontWeight: 600 }}>Pay Now →</a>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Messaging */}
        <ClientPortalMessaging token={token} initialMessages={messages} clientName={client.name} />
      </div>
    </div>
  );
}
