"use client";

import { use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/trpc/client";
import {
  ArrowLeft, Plus, Globe, Phone, Mail, Building2, Users,
  MapPin, Loader2, ExternalLink, FolderKanban, ChevronRight,
  Zap, AlertCircle,
} from "lucide-react";
import { formatScore } from "@/lib/utils";

const STATUS_LABEL: Record<string, string> = {
  brief: "Brief", scored: "Scored", scoped: "Scoped",
  architected: "Architected", generating: "Generating", ready: "Ready", archived: "Archived",
};

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>{label}</span>
      <span className="text-sm" style={{ color: "var(--text-primary)" }}>{value}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      className="rounded-xl p-6 space-y-4"
      style={{ background: "var(--surface-card)", border: "1px solid var(--surface-border)" }}
    >
      <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>{title}</h3>
      {children}
    </div>
  );
}

export default function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { data: client, isLoading } = api.clients.get.useQuery({ id });
  const deleteClient = api.clients.delete.useMutation({
    onSuccess: () => router.push("/clients"),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-5 h-5 animate-spin" style={{ color: "var(--text-muted)" }} />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="p-8 text-center">
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Client not found.</p>
        <Link href="/clients" className="text-sm mt-2 inline-block hover:underline" style={{ color: "var(--brand-primary)" }}>
          ← Back to clients
        </Link>
      </div>
    );
  }

  const initials = client.name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/clients"
            className="flex items-center gap-1.5 text-sm transition-opacity hover:opacity-70"
            style={{ color: "var(--text-secondary)" }}
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Clients
          </Link>
          <ChevronRight className="w-3.5 h-3.5" style={{ color: "var(--surface-border)" }} />
          <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{client.name}</span>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/clients/${id}/edit`}
            className="px-3 py-2 text-xs font-medium rounded-lg border transition-colors hover:opacity-80"
            style={{ color: "var(--text-secondary)", borderColor: "var(--surface-border)", background: "var(--surface-elevated)" }}
          >
            Edit Profile
          </Link>
          <Link
            href={`/projects/new?clientId=${id}`}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ background: "var(--brand-gradient)" }}
          >
            <Plus className="w-3.5 h-3.5" /> New Project
          </Link>
        </div>
      </div>

      {/* Identity card */}
      <div
        className="rounded-2xl p-6"
        style={{ background: "var(--surface-card)", border: "1px solid var(--surface-border)" }}
      >
        <div className="flex items-start gap-5">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-bold shrink-0"
            style={{ background: "var(--brand-gradient)", color: "white" }}
          >
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>{client.name}</h1>
            {client.company && (
              <div className="flex items-center gap-1.5 mt-0.5">
                <Building2 className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
                <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
                  {client.company}
                  {client.companySize && ` · ${client.companySize} employees`}
                </span>
              </div>
            )}
            {client.industry && (
              <span
                className="inline-block mt-2 px-2.5 py-0.5 rounded-full text-xs font-medium"
                style={{ background: "hsl(220 90% 62% / 0.12)", color: "var(--brand-primary)" }}
              >
                {client.industry}
              </span>
            )}
          </div>
          <div className="flex flex-col gap-2 items-end">
            {client.email && (
              <a href={`mailto:${client.email}`} className="flex items-center gap-1.5 text-xs hover:underline" style={{ color: "var(--text-secondary)" }}>
                <Mail className="w-3 h-3" /> {client.email}
              </a>
            )}
            {client.phone && (
              <a href={`tel:${client.phone}`} className="flex items-center gap-1.5 text-xs hover:underline" style={{ color: "var(--text-secondary)" }}>
                <Phone className="w-3 h-3" /> {client.phone}
              </a>
            )}
            {client.website && (
              <a href={client.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs hover:underline" style={{ color: "var(--text-secondary)" }}>
                <Globe className="w-3 h-3" /> {client.website.replace(/^https?:\/\//, "")}
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            )}
            {client.region && (
              <div className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-muted)" }}>
                <MapPin className="w-3 h-3" /> {client.region}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* Business Context */}
        <div className="col-span-2 space-y-4">
          {(client.businessDescription || client.targetCustomers || client.currentChallenges || client.existingTech) && (
            <Section title="Business Context">
              <div className="space-y-4">
                {client.businessDescription && (
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>What they do</div>
                    <p className="text-sm leading-relaxed" style={{ color: "var(--text-primary)" }}>{client.businessDescription}</p>
                  </div>
                )}
                {client.targetCustomers && (
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>Their customers</div>
                    <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>{client.targetCustomers}</p>
                  </div>
                )}
                {client.currentChallenges && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <AlertCircle className="w-3 h-3" style={{ color: "hsl(35, 90%, 60%)" }} />
                      <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Challenges we're solving</span>
                    </div>
                    <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>{client.currentChallenges}</p>
                  </div>
                )}
                {client.existingTech && (
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>Existing tech / tools</div>
                    <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{client.existingTech}</p>
                  </div>
                )}
              </div>
            </Section>
          )}

          {/* Projects */}
          <Section title={`Projects (${client.projects.length})`}>
            {client.projects.length === 0 ? (
              <div className="text-center py-6">
                <FolderKanban className="w-8 h-8 mx-auto mb-3" style={{ color: "var(--text-muted)" }} />
                <p className="text-sm font-medium mb-1" style={{ color: "var(--text-primary)" }}>No projects yet</p>
                <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>Start the first one for this client</p>
                <Link
                  href={`/projects/new?clientId=${id}`}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white"
                  style={{ background: "var(--brand-gradient)" }}
                >
                  <Plus className="w-3.5 h-3.5" /> New Project
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {client.projects.map((project) => {
                  const scoreInfo = project.score ? formatScore(project.score.totalScore) : null;
                  return (
                    <Link
                      key={project.id}
                      href={`/projects/${project.id}`}
                      className="flex items-center justify-between px-4 py-3 rounded-xl transition-colors group"
                      style={{ background: "var(--surface-elevated)", border: "1px solid var(--surface-border-subtle)" }}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--brand-primary)" }} />
                        <div>
                          <div className="text-sm font-medium group-hover:underline" style={{ color: "var(--text-primary)" }}>
                            {project.name}
                          </div>
                          <div className="text-xs capitalize" style={{ color: "var(--text-muted)" }}>
                            {project.projectType.replace("_", " ")} · {STATUS_LABEL[project.status] ?? project.status}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {scoreInfo && (
                          <span
                            className="text-xs font-bold px-2 py-0.5 rounded-full"
                            style={{ background: scoreInfo.bgColor, color: scoreInfo.color, border: `1px solid ${scoreInfo.borderColor}` }}
                          >
                            {project.score?.totalScore}/70
                          </span>
                        )}
                        <ChevronRight className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
                      </div>
                    </Link>
                  );
                })}
                <Link
                  href={`/projects/new?clientId=${id}`}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-medium transition-opacity hover:opacity-70"
                  style={{ color: "var(--brand-primary)", border: "1px dashed hsl(220 90% 62% / 0.3)" }}
                >
                  <Plus className="w-3 h-3" /> Add another project
                </Link>
              </div>
            )}
          </Section>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <Section title="Commercial">
            <div className="space-y-3">
              <InfoRow label="Typical Budget" value={client.typicalBudget} />
              <InfoRow label="Urgency" value={client.urgency ? { exploring: "Exploring options", planning: "Planning (1–3 months)", urgent: "Urgent — start ASAP" }[client.urgency] : null} />
              <InfoRow label="Decision Maker" value={client.decisionMakerRole} />
            </div>
          </Section>

          {client.notes && (
            <Section title="Internal Notes">
              <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>{client.notes}</p>
            </Section>
          )}

          <Section title="Quick Actions">
            <div className="space-y-2">
              <Link
                href={`/projects/new?clientId=${id}`}
                className="flex items-center gap-2 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-opacity hover:opacity-80"
                style={{ background: "var(--brand-gradient)", color: "white" }}
              >
                <Zap className="w-3.5 h-3.5" /> New Project for this Client
              </Link>
              <Link
                href={`/clients/${id}/edit`}
                className="flex items-center gap-2 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-colors"
                style={{ background: "var(--surface-elevated)", color: "var(--text-secondary)", border: "1px solid var(--surface-border)" }}
              >
                <Users className="w-3.5 h-3.5" /> Edit Client Profile
              </Link>
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}
