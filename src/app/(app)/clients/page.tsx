import { db } from "@/server/db";
import { clients } from "@/server/db/schema";
import { asc } from "drizzle-orm";
import { ArrowRight } from "lucide-react";

export default async function ClientsPage() {
  const allClients = await db.query.clients.findMany({
    orderBy: [asc(clients.name)],
    with: { projects: true },
  });

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Clients</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-0.5">
            {allClients.length} client{allClients.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-[var(--surface-border)]">
        {allClients.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="font-medium text-[var(--text-primary)] mb-1">No clients yet</p>
            <p className="text-sm text-[var(--text-secondary)]">Clients are added when you create a project</p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--surface-border)]">
            {allClients.map((client) => (
              <div key={client.id} className="flex items-center justify-between px-6 py-4">
                <div>
                  <div className="font-medium text-sm text-[var(--text-primary)]">{client.name}</div>
                  <div className="text-xs text-[var(--text-secondary)] mt-0.5">
                    {[
                      client.company,
                      client.email,
                      `${client.projects.length} project${client.projects.length !== 1 ? "s" : ""}`,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-[var(--text-muted)]" />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
