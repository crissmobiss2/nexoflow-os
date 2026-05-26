import { db } from "@/server/db";
import { sprintTasks, users, projects, leads, leadCalls, timeEntries } from "@/server/db/schema";
import { eq, desc, gte, and, inArray, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export const revalidate = 30;

function fmt(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export default async function TeamStandupPage() {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");

  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // All team members
  const allUsers = await db.select().from(users);

  // All in-progress tasks
  const activeTasks = await db.query.sprintTasks.findMany({
    where: inArray(sprintTasks.status, ["todo", "in_progress", "review"] as any[]),
    orderBy: [desc(sprintTasks.updatedAt)],
    with: { project: true, assignee: true },
    limit: 50,
  });

  // Completed this week
  const completedThisWeek = await db.query.sprintTasks.findMany({
    where: and(
      eq(sprintTasks.status, "done" as any),
      gte(sprintTasks.updatedAt, weekAgo),
    ),
    orderBy: [desc(sprintTasks.updatedAt)],
    with: { project: true, assignee: true },
    limit: 30,
  });

  // Upcoming calls
  const upcomingCalls = await db.query.leadCalls.findMany({
    where: gte(leadCalls.scheduledAt, today),
    orderBy: [desc(leadCalls.scheduledAt)],
    with: { lead: true, caller: true },
    limit: 10,
  });

  // Time logged this week per user
  const timeThisWeek = await db
    .select({
      userId: timeEntries.userId,
      totalMinutes: sql<number>`COALESCE(SUM(minutes_logged), 0)::int`,
    })
    .from(timeEntries)
    .where(gte(timeEntries.date, weekAgo))
    .groupBy(timeEntries.userId);

  const timeByUser = Object.fromEntries(timeThisWeek.map((r) => [r.userId, r.totalMinutes]));

  // Group active tasks by assignee
  const tasksByUser: Record<string, typeof activeTasks> = {};
  for (const task of activeTasks) {
    const uid = (task as any).assignee?.id ?? "unassigned";
    if (!tasksByUser[uid]) tasksByUser[uid] = [];
    tasksByUser[uid]!.push(task);
  }

  const STATUS_COLOR: Record<string, string> = {
    todo: "#60a5fa", in_progress: "#f59e0b", review: "#a78bfa", done: "#22c55e",
  };

  return (
    <div style={{ padding: 32, maxWidth: 1100, margin: "0 auto", fontFamily: "Inter, system-ui, sans-serif", color: "#e2e8f0" }}>
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <div style={{ width: 6, height: 20, borderRadius: 3, background: "linear-gradient(135deg, #7c5cbf, #a855f7)" }} />
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "#e2e8f0" }}>Team Standup</h1>
        </div>
        <p style={{ fontSize: 14, color: "#555", paddingLeft: 14 }}>Daily async view — who's working on what, calls today, wins this week</p>
      </div>

      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 32 }}>
        {[
          { label: "Team Members", value: String(allUsers.length), color: "#60a5fa" },
          { label: "Active Tasks", value: String(activeTasks.length), color: "#f59e0b" },
          { label: "Completed This Week", value: String(completedThisWeek.length), color: "#22c55e" },
          { label: "Calls Today", value: String(upcomingCalls.length), color: "#a78bfa" },
        ].map((s) => (
          <div key={s.label} style={{ background: "#111118", border: "1px solid #1e1e2e", borderRadius: 14, padding: "18px 20px" }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11, color: "#555", textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 24, alignItems: "start" }}>
        {/* Team cards */}
        <div>
          <div style={{ fontSize: 11, color: "#555", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 14 }}>Team Workload</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {allUsers.map((user) => {
              const myTasks = tasksByUser[user.id] ?? [];
              const minutes = timeByUser[user.id] ?? 0;
              return (
                <div key={user.id} style={{ background: "#111118", border: "1px solid #1e1e2e", borderRadius: 14, padding: "16px 20px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: myTasks.length > 0 ? 12 : 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 36, height: 36, borderRadius: "50%", background: "linear-gradient(135deg, #7c5cbf, #a855f7)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 15, color: "#fff" }}>
                        {(user.name ?? user.email ?? "?").charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14, color: "#e2e8f0" }}>{user.name ?? user.email}</div>
                        <div style={{ fontSize: 11, color: "#555", marginTop: 1 }}>{user.role} · {fmt(minutes)} this week</div>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      {(["todo", "in_progress", "review"] as const).map((s) => {
                        const count = myTasks.filter((t) => t.status === s).length;
                        if (!count) return null;
                        return (
                          <span key={s} style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: `${STATUS_COLOR[s]}1a`, color: STATUS_COLOR[s] }}>{count} {s.replace("_", " ")}</span>
                        );
                      })}
                    </div>
                  </div>
                  {myTasks.length > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {myTasks.slice(0, 4).map((task) => (
                        <div key={task.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#888" }}>
                          <div style={{ width: 6, height: 6, borderRadius: "50%", background: STATUS_COLOR[task.status], flexShrink: 0 }} />
                          <span style={{ flex: 1, color: "#aaa" }}>{task.title}</span>
                          {(task as any).project && <span style={{ color: "#444", fontSize: 11 }}>{(task as any).project.name.slice(0, 20)}</span>}
                        </div>
                      ))}
                      {myTasks.length > 4 && <div style={{ fontSize: 11, color: "#444" }}>+{myTasks.length - 4} more tasks</div>}
                    </div>
                  )}
                  {myTasks.length === 0 && (
                    <div style={{ fontSize: 12, color: "#333" }}>No active tasks assigned</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right column: calls + wins */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Upcoming calls */}
          <div>
            <div style={{ fontSize: 11, color: "#555", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 14 }}>Calls Today & Upcoming</div>
            {upcomingCalls.length === 0 ? (
              <div style={{ background: "#111118", border: "1px solid #1e1e2e", borderRadius: 14, padding: 20, textAlign: "center", color: "#444", fontSize: 13 }}>No calls scheduled</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {upcomingCalls.map((call) => (
                  <div key={call.id} style={{ background: "#111118", border: "1px solid #1e1e2e", borderRadius: 12, padding: "12px 16px" }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: "#e2e8f0" }}>
                      {(call as any).lead ? `${(call as any).lead.firstName ?? ""} ${(call as any).lead.lastName ?? ""} · ${(call as any).lead.company ?? ""}`.trim() : "Lead call"}
                    </div>
                    <div style={{ fontSize: 11, color: "#555", marginTop: 4 }}>
                      {call.scheduledAt ? new Date(call.scheduledAt).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "No time set"}
                      {(call as any).caller && ` · ${(call as any).caller.name}`}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Wins this week */}
          <div>
            <div style={{ fontSize: 11, color: "#555", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 14 }}>Completed This Week 🏆</div>
            {completedThisWeek.length === 0 ? (
              <div style={{ background: "#111118", border: "1px solid #1e1e2e", borderRadius: 14, padding: 20, textAlign: "center", color: "#444", fontSize: 13 }}>Nothing completed yet this week</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {completedThisWeek.slice(0, 8).map((task) => (
                  <div key={task.id} style={{ background: "#111118", border: "1px solid #1e1e2e", borderRadius: 12, padding: "10px 14px", display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ color: "#22c55e", fontSize: 14 }}>✓</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, color: "#e2e8f0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{task.title}</div>
                      {(task as any).assignee && <div style={{ fontSize: 10, color: "#444" }}>{(task as any).assignee.name}</div>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
