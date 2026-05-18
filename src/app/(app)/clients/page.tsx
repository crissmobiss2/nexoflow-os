export const dynamic = "force-dynamic";

import { db } from "@/server/db";
import { clients } from "@/server/db/schema";
import { asc } from "drizzle-orm";
import { Users, ArrowRight } from "lucide-react";
import Link from "next/link";

export default async function ClientsPage() {
  const allClients = await db.query.clients.findMany({
    orderBy: [asc(clients.name)],
    with: { projects: true },
  });

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-1.5 h-5 rounded-full" style={{ background: "var(--brand-gradient)" }} />
          <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>Clients</h1>
        </div>
        <p className="text-sm pl-3.5" style={{ color: "var(--text-secondary)" }}>
          {allClients.length} client{allClients.length !== 1 ? "s" : ""} on record
        </p>
      </div>

      <div
        className="rounded-xl overflow-hidden"
        style={{ background: "var(--surface-card)", border: "1px solid var(--surface-border)" }}
      >
        {allClients.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4"
              style={{ background: "hsl(220 90% 62% / 0.1)" }}
            >
              <Users className="w-5 h-5" style={{ color: "var(--brand-primary)" }} />
            </div>
            <p className="text-sm font-medium mb-1" style={{ color: "var(--text-primary)" }}>
              No clients yet
            </p>
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
              Clients are created automatically when you add a project
            </p>
          </div>
        ) : (
          <>
            <div
              className="grid px-6 py-3"
              style={{
                borderBottom: "1px solid var(--surface-border)",
                gridTemplateColumns: "1fr 200px 100px 20px",
                gap: "1rem",
              }}
            >
              {["Client", "Contact", "Projects", ""].map((h) => (
                <div key={h} className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                  {h}
                </div>
              ))}
            </div>

            {allClients.map((client) => (
              <div
                key={client.id}
                className="grid items-center px-6 py-4"
                style={{
                  borderBottom: "1px solid var(--surface-border-subtle)",
                  gridTemplateColumns: "1fr 200px 100px 20px",
                  gap: "1rem",
                }}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-sm font-bold"
                    style={{ background: "var(--surface-elevated)", color: "var(--text-secondary)" }}
                  >
                    {client.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
                      {client.name}
                    </div>
                    {client.company && (
                      <div className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
                        {client.company}
                      </div>
                    )}
                  </div>
                </div>

                <div className="min-w-0">
                  {client.email ? (
                    <div className="text-xs truncate" style={{ color: "var(--text-secondary)" }}>
                      {client.email}
                    </div>
                  ) : (
                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>—</span>
                  )}
                </div>

                <div className="text-sm" style={{ color: "var(--text-secondary)" }}>
                  <span className="font-medium" style={{ color: "var(--text-primary)" }}>
                    {client.projects.length}
                  </span>
                  <span className="text-xs ml-1" style={{ color: "var(--text-muted)" }}>
                    project{client.projects.length !== 1 ? "s" : ""}
                  </span>
                </div>

                <ArrowRight className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
