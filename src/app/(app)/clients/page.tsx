export const revalidate = 30;

import { db } from "@/server/db";
import { clients } from "@/server/db/schema";
import { desc } from "drizzle-orm";
import { Users, Plus, CheckCircle2, Clock, ArrowRight, MapPin, Building2 } from "lucide-react";
import Link from "next/link";

const URGENCY_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  exploring: { label: "Exploring",  color: "hsl(207, 70%, 60%)", bg: "hsl(207, 90%, 60%, 0.12)" },
  planning:  { label: "Planning",   color: "hsl(35,  90%, 60%)", bg: "hsl(35,  90%, 60%, 0.12)" },
  urgent:    { label: "Urgent",     color: "hsl(142, 68%, 52%)", bg: "hsl(142, 68%, 52%, 0.12)" },
};

export default async function ClientsPage() {
  const allClients = await db.query.clients.findMany({
    orderBy: [desc(clients.createdAt)],
    with: { projects: true },
  });

  const onboarded = allClients.filter((c) => c.onboardedAt);
  const pending   = allClients.filter((c) => !c.onboardedAt);

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-1.5 h-5 rounded-full" style={{ background: "var(--brand-gradient)" }} />
            <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>Clients</h1>
          </div>
          <p className="text-sm pl-3.5" style={{ color: "var(--text-secondary)" }}>
            {allClients.length} client{allClients.length !== 1 ? "s" : ""}
            {onboarded.length > 0 && ` · ${onboarded.length} fully onboarded`}
          </p>
        </div>
        <Link
          href="/clients/new"
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
          style={{ background: "var(--brand-gradient)" }}
        >
          <Plus className="w-4 h-4" /> Onboard Client
        </Link>
      </div>

      {allClients.length === 0 ? (
        <div
          className="rounded-2xl flex flex-col items-center justify-center py-24 text-center"
          style={{ background: "var(--surface-card)", border: "1px solid var(--surface-border)" }}
        >
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5"
            style={{ background: "hsl(220 90% 62% / 0.1)" }}
          >
            <Users className="w-6 h-6" style={{ color: "var(--brand-primary)" }} />
          </div>
          <h2 className="text-base font-semibold mb-2" style={{ color: "var(--text-primary)" }}>No clients yet</h2>
          <p className="text-sm mb-6 max-w-xs" style={{ color: "var(--text-secondary)" }}>
            Onboard your first client to start capturing briefs, scopes, and architecture documents.
          </p>
          <Link
            href="/clients/new"
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white"
            style={{ background: "var(--brand-gradient)" }}
          >
            <Plus className="w-4 h-4" /> Onboard first client
          </Link>
        </div>
      ) : (
        <div
          className="rounded-2xl overflow-hidden"
          style={{ background: "var(--surface-card)", border: "1px solid var(--surface-border)" }}
        >
          {/* Column headers */}
          <div
            className="grid px-6 py-3"
            style={{
              borderBottom: "1px solid var(--surface-border)",
              gridTemplateColumns: "1fr 160px 120px 100px 80px 16px",
              gap: "1rem",
            }}
          >
            {["Client", "Company / Region", "Industry", "Projects", "Status", ""].map((h) => (
              <div key={h} className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                {h}
              </div>
            ))}
          </div>

          {allClients.map((client) => {
            const urgencyInfo = client.urgency ? URGENCY_BADGE[client.urgency] : null;
            const isOnboarded = !!client.onboardedAt;

            return (
              <Link
                key={client.id}
                href={`/clients/${client.id}`}
                className="grid items-center px-6 py-4 transition-colors hover:bg-white/[0.02] group"
                style={{
                  borderBottom: "1px solid var(--surface-border-subtle)",
                  gridTemplateColumns: "1fr 160px 120px 100px 80px 16px",
                  gap: "1rem",
                }}
              >
                {/* Name + avatar */}
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-sm font-bold"
                    style={{ background: "var(--brand-gradient)", color: "white" }}
                  >
                    {client.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate group-hover:text-[var(--brand-primary)] transition-colors" style={{ color: "var(--text-primary)" }}>
                      {client.name}
                    </div>
                    {client.email && (
                      <div className="text-xs truncate" style={{ color: "var(--text-muted)" }}>{client.email}</div>
                    )}
                  </div>
                </div>

                {/* Company + region */}
                <div className="min-w-0">
                  {client.company ? (
                    <div className="flex items-center gap-1.5">
                      <Building2 className="w-3 h-3 shrink-0" style={{ color: "var(--text-muted)" }} />
                      <span className="text-xs truncate" style={{ color: "var(--text-secondary)" }}>{client.company}</span>
                    </div>
                  ) : <span className="text-xs" style={{ color: "var(--text-muted)" }}>—</span>}
                  {client.region && (
                    <div className="flex items-center gap-1 mt-0.5">
                      <MapPin className="w-2.5 h-2.5 shrink-0" style={{ color: "var(--text-muted)" }} />
                      <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>{client.region}</span>
                    </div>
                  )}
                </div>

                {/* Industry */}
                <div className="text-xs truncate" style={{ color: "var(--text-secondary)" }}>
                  {client.industry ?? <span style={{ color: "var(--text-muted)" }}>—</span>}
                </div>

                {/* Projects */}
                <div>
                  <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{client.projects.length}</span>
                  <span className="text-xs ml-1" style={{ color: "var(--text-muted)" }}>project{client.projects.length !== 1 ? "s" : ""}</span>
                </div>

                {/* Status / Urgency */}
                <div>
                  {urgencyInfo ? (
                    <span
                      className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                      style={{ background: urgencyInfo.bg, color: urgencyInfo.color }}
                    >
                      {urgencyInfo.label}
                    </span>
                  ) : isOnboarded ? (
                    <CheckCircle2 className="w-3.5 h-3.5" style={{ color: "hsl(142, 68%, 52%)" }} />
                  ) : (
                    <Clock className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
                  )}
                </div>

                <ArrowRight className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
