"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/trpc/client";
import {
  ArrowLeft, ChevronRight, Globe, Mail, Phone, Building2, MapPin,
  Linkedin, Loader2, Sparkles, Zap, Send, ExternalLink, Tag, FolderKanban,
  ChevronDown, CheckCircle2, AlertCircle, Target, Trash2,
} from "lucide-react";

const PIPELINE_STAGES = [
  { key: "new",            label: "New" },
  { key: "reviewing",      label: "Reviewing" },
  { key: "demo_queued",    label: "Demo Queued" },
  { key: "demo_generated", label: "Demo Ready" },
  { key: "sent",           label: "Sent" },
  { key: "replied",        label: "Replied" },
  { key: "won",            label: "Won" },
  { key: "lost",           label: "Lost" },
  { key: "archived",       label: "Archived" },
] as const;

const STATUS_COLORS: Record<string, { color: string; bg: string }> = {
  new:            { color: "hsl(207, 70%, 60%)", bg: "hsl(207, 90%, 60%, 0.12)" },
  reviewing:      { color: "hsl(35, 90%, 60%)",  bg: "hsl(35, 90%, 60%, 0.12)"  },
  demo_queued:    { color: "hsl(262, 83%, 68%)", bg: "hsl(262, 83%, 68%, 0.12)" },
  demo_generated: { color: "hsl(262, 83%, 68%)", bg: "hsl(262, 83%, 68%, 0.15)" },
  sent:           { color: "hsl(142, 68%, 52%)", bg: "hsl(142, 68%, 52%, 0.12)" },
  replied:        { color: "hsl(142, 68%, 52%)", bg: "hsl(142, 68%, 52%, 0.18)" },
  won:            { color: "hsl(142, 80%, 45%)", bg: "hsl(142, 80%, 45%, 0.18)" },
  lost:           { color: "hsl(0, 70%, 60%)",   bg: "hsl(0, 70%, 60%, 0.12)"   },
  archived:       { color: "hsl(220, 14%, 55%)", bg: "hsl(220, 14%, 55%, 0.1)"  },
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl p-5 space-y-3" style={{ background: "var(--surface-card)", border: "1px solid var(--surface-border)" }}>
      <h3 className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>{title}</h3>
      {children}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: "var(--text-muted)" }}>{label}</div>
      <div className="text-sm" style={{ color: "var(--text-primary)" }}>{value}</div>
    </div>
  );
}

export default function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [showStatusMenu, setShowStatusMenu] = useState(false);

  const { data: lead, isLoading, refetch } = api.leads.get.useQuery({ id });
  const updateMutation = api.leads.update.useMutation({ onSuccess: () => refetch() });
  const generateInsights = api.leads.generateInsights.useMutation({ onSuccess: () => refetch() });
  const generateDemo = api.leads.generateDemo.useMutation({
    onSuccess: (result) => {
      refetch();
      if (result.projectId) router.push(`/projects/${result.projectId}`);
    },
  });
  const deleteMutation = api.leads.delete.useMutation({ onSuccess: () => router.push("/leads") });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-5 h-5 animate-spin" style={{ color: "var(--text-muted)" }} />
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="p-8 text-center">
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Lead not found.</p>
        <Link href="/leads" className="text-sm mt-2 inline-block hover:underline" style={{ color: "var(--brand-primary)" }}>← Back</Link>
      </div>
    );
  }

  const fullName = [lead.firstName, lead.lastName].filter(Boolean).join(" ") || lead.email || "Unnamed Lead";
  const stageInfo = STATUS_COLORS[lead.status] ?? { color: "var(--text-muted)", bg: "var(--surface-elevated)" };
  const stageLabel = PIPELINE_STAGES.find((s) => s.key === lead.status)?.label ?? lead.status;

  let insights: Record<string, unknown> | null = null;
  if (lead.aiInsights) {
    try { insights = JSON.parse(lead.aiInsights); } catch { /* ignore */ }
  }

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      {/* Breadcrumb + header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Link href="/leads" className="flex items-center gap-1.5 text-sm transition-opacity hover:opacity-70" style={{ color: "var(--text-secondary)" }}>
            <ArrowLeft className="w-3.5 h-3.5" /> Leads
          </Link>
          <ChevronRight className="w-3.5 h-3.5" style={{ color: "var(--surface-border)" }} />
          <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{fullName}</span>
        </div>
        <div className="flex items-center gap-2">
          {/* Status picker */}
          <div className="relative">
            <button
              onClick={() => setShowStatusMenu(!showStatusMenu)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all"
              style={{ background: stageInfo.bg, color: stageInfo.color, border: `1px solid ${stageInfo.color}30` }}
            >
              {stageLabel}
              <ChevronDown className="w-3 h-3" />
            </button>
            {showStatusMenu && (
              <div
                className="absolute right-0 top-full mt-1.5 w-48 rounded-xl overflow-hidden z-20 shadow-xl"
                style={{ background: "var(--surface-card)", border: "1px solid var(--surface-border)" }}
              >
                {PIPELINE_STAGES.map((s) => {
                  const sc = STATUS_COLORS[s.key]!;
                  return (
                    <button
                      key={s.key}
                      onClick={() => {
                        updateMutation.mutate({ id: lead.id, status: s.key });
                        setShowStatusMenu(false);
                      }}
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-xs font-medium text-left transition-colors hover:opacity-80"
                      style={lead.status === s.key ? { background: sc.bg, color: sc.color } : { color: "var(--text-secondary)" }}
                    >
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: sc.color }} />
                      {s.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <Link
            href={`/leads/${id}/outreach`}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white transition-opacity hover:opacity-90"
            style={{ background: "var(--brand-gradient)" }}
          >
            <Send className="w-3.5 h-3.5" /> Send Outreach
          </Link>
        </div>
      </div>

      {/* Identity card */}
      <div className="rounded-2xl p-6" style={{ background: "var(--surface-card)", border: "1px solid var(--surface-border)" }}>
        <div className="flex items-start gap-5">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-bold shrink-0"
            style={{ background: "var(--brand-gradient)", color: "white" }}
          >
            {fullName.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>{fullName}</h1>
            {lead.jobTitle && (
              <div className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>{lead.jobTitle}</div>
            )}
            {lead.company && (
              <div className="flex items-center gap-1.5 mt-1">
                <Building2 className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
                <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
                  {lead.company}
                  {lead.companySize && ` · ${lead.companySize}`}
                </span>
              </div>
            )}
            {lead.industry && (
              <span
                className="inline-block mt-2 px-2.5 py-0.5 rounded-full text-xs font-medium"
                style={{ background: "hsl(220 90% 62% / 0.12)", color: "var(--brand-primary)" }}
              >
                {lead.industry}
              </span>
            )}
          </div>
          <div className="flex flex-col gap-2 items-end shrink-0">
            {lead.email && (
              <a href={`mailto:${lead.email}`} className="flex items-center gap-1.5 text-xs hover:underline" style={{ color: "var(--text-secondary)" }}>
                <Mail className="w-3 h-3" /> {lead.email}
              </a>
            )}
            {lead.phone && (
              <a href={`tel:${lead.phone}`} className="flex items-center gap-1.5 text-xs hover:underline" style={{ color: "var(--text-secondary)" }}>
                <Phone className="w-3 h-3" /> {lead.phone}
              </a>
            )}
            {lead.website && (
              <a href={lead.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs hover:underline" style={{ color: "var(--text-secondary)" }}>
                <Globe className="w-3 h-3" /> {lead.website.replace(/^https?:\/\//, "")}
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            )}
            {lead.linkedIn && (
              <a href={lead.linkedIn} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs hover:underline" style={{ color: "var(--text-secondary)" }}>
                <Linkedin className="w-3 h-3" /> LinkedIn
              </a>
            )}
            {lead.region && (
              <div className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-muted)" }}>
                <MapPin className="w-3 h-3" /> {lead.region}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 space-y-4">
          {/* AI Insights */}
          {insights ? (
            <div
              className="rounded-xl p-5"
              style={{ background: "hsl(262 83% 68% / 0.06)", border: "1px solid hsl(262 83% 68% / 0.2)" }}
            >
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="w-4 h-4" style={{ color: "hsl(262, 83%, 68%)" }} />
                <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "hsl(262, 83%, 68%)" }}>AI Insights</h3>
              </div>
              <div className="space-y-4">
                {!!insights.summary && (
                  <p className="text-sm leading-relaxed" style={{ color: "var(--text-primary)" }}>
                    {String(insights.summary)}
                  </p>
                )}
                {!!insights.whatWeBuild && (
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>What we'd build</div>
                    <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{String(insights.whatWeBuild)}</p>
                  </div>
                )}
                {!!insights.techRecommendation && (
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>Tech recommendation</div>
                    <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{String(insights.techRecommendation)}</p>
                  </div>
                )}
                {!!insights.estimatedScope && (
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>Estimated scope</div>
                    <span
                      className="text-xs font-semibold px-2.5 py-1 rounded-full"
                      style={{ background: "hsl(262 83% 68% / 0.15)", color: "hsl(262, 83%, 68%)" }}
                    >
                      {String(insights.estimatedScope)}
                    </span>
                  </div>
                )}
                {Array.isArray(insights.talkingPoints) && (insights.talkingPoints as string[]).length > 0 && (
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>Talking points</div>
                    <ul className="space-y-1.5">
                      {(insights.talkingPoints as string[]).map((pt, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm" style={{ color: "var(--text-secondary)" }}>
                          <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: "hsl(142, 68%, 52%)" }} />
                          {pt}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {Array.isArray(insights.redFlags) && (insights.redFlags as string[]).length > 0 && (
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>Watch out for</div>
                    <ul className="space-y-1.5">
                      {(insights.redFlags as string[]).map((f, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm" style={{ color: "var(--text-secondary)" }}>
                          <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: "hsl(35, 90%, 60%)" }} />
                          {f}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {!!insights.nextAction && (
                  <div
                    className="flex items-start gap-2 px-4 py-3 rounded-xl"
                    style={{ background: "hsl(142 68% 52% / 0.08)", border: "1px solid hsl(142 68% 52% / 0.2)" }}
                  >
                    <Zap className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "hsl(142, 68%, 52%)" }} />
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "hsl(142, 68%, 52%)" }}>Next action</div>
                      <p className="text-sm mt-0.5" style={{ color: "var(--text-primary)" }}>{String(insights.nextAction)}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div
              className="rounded-xl p-5"
              style={{ background: "hsl(262 83% 68% / 0.05)", border: "1px dashed hsl(262 83% 68% / 0.3)" }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4" style={{ color: "hsl(262, 83%, 68%)" }} />
                  <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>Generate AI Insights</span>
                </div>
                <button
                  onClick={() => generateInsights.mutate({ id: lead.id })}
                  disabled={generateInsights.isPending}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-opacity hover:opacity-80 disabled:opacity-50"
                  style={{ background: "hsl(262 83% 68% / 0.15)", color: "hsl(262, 83%, 68%)" }}
                >
                  {generateInsights.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  {generateInsights.isPending ? "Analyzing…" : "Analyze Lead"}
                </button>
              </div>
              <p className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>
                AI will analyze their tech stack, pain points, and scraped data to give you a sales brief, recommended solution, and talking points.
              </p>
            </div>
          )}

          {/* Lead intel */}
          {(lead.techStack || lead.painPoints || lead.scrapedData) && (
            <Section title="Scraped Intelligence">
              <div className="space-y-3">
                <InfoRow label="Tech Stack" value={lead.techStack} />
                <InfoRow label="Pain Points" value={lead.painPoints} />
                {lead.scrapedData && (
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>Raw Scraped Data</div>
                    <pre
                      className="text-xs whitespace-pre-wrap rounded-lg p-3 max-h-48 overflow-y-auto"
                      style={{ background: "var(--surface-elevated)", color: "var(--text-secondary)", border: "1px solid var(--surface-border-subtle)" }}
                    >
                      {lead.scrapedData}
                    </pre>
                  </div>
                )}
              </div>
            </Section>
          )}

          {/* Outreach history */}
          {lead.outreach.length > 0 && (
            <Section title={`Outreach History (${lead.outreach.length})`}>
              <div className="space-y-2">
                {lead.outreach.map((o) => (
                  <div
                    key={o.id}
                    className="px-4 py-3 rounded-xl"
                    style={{ background: "var(--surface-elevated)", border: "1px solid var(--surface-border-subtle)" }}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span
                        className="text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full"
                        style={{ background: "hsl(220 90% 62% / 0.1)", color: "var(--brand-primary)" }}
                      >
                        {o.channel}
                      </span>
                      <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                        {new Date(o.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    {o.subject && <div className="text-xs font-semibold mb-1" style={{ color: "var(--text-primary)" }}>{o.subject}</div>}
                    <p className="text-xs leading-relaxed line-clamp-3" style={{ color: "var(--text-secondary)" }}>{o.message}</p>
                    {o.openedAt && (
                      <div className="flex items-center gap-1 mt-2">
                        <CheckCircle2 className="w-3 h-3" style={{ color: "hsl(142, 68%, 52%)" }} />
                        <span className="text-[11px]" style={{ color: "hsl(142, 68%, 52%)" }}>Opened {new Date(o.openedAt).toLocaleDateString()}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Section>
          )}
        </div>

        {/* Right sidebar */}
        <div className="space-y-4">
          {/* Quick actions */}
          <Section title="Actions">
            <div className="space-y-2">
              <button
                onClick={() => generateInsights.mutate({ id: lead.id })}
                disabled={generateInsights.isPending}
                className="flex items-center gap-2 w-full px-3 py-2.5 rounded-xl text-xs font-semibold transition-opacity hover:opacity-80 disabled:opacity-50"
                style={{ background: "hsl(262 83% 68% / 0.12)", color: "hsl(262, 83%, 68%)" }}
              >
                {generateInsights.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                {generateInsights.isPending ? "Analyzing…" : "Re-analyze with AI"}
              </button>
              <button
                onClick={() => generateDemo.mutate({ id: lead.id })}
                disabled={generateDemo.isPending}
                className="flex items-center gap-2 w-full px-3 py-2.5 rounded-xl text-xs font-semibold transition-opacity hover:opacity-80 disabled:opacity-50"
                style={{ background: "var(--brand-gradient)", color: "white" }}
              >
                {generateDemo.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                {generateDemo.isPending ? "Creating…" : "Generate Demo Project"}
              </button>
              <Link
                href={`/leads/${id}/outreach`}
                className="flex items-center gap-2 w-full px-3 py-2.5 rounded-xl text-xs font-semibold transition-colors"
                style={{ background: "hsl(142 68% 52% / 0.1)", color: "hsl(142, 68%, 52%)" }}
              >
                <Send className="w-3.5 h-3.5" /> Send Outreach
              </Link>
              {lead.projectId && (
                <Link
                  href={`/projects/${lead.projectId}`}
                  className="flex items-center gap-2 w-full px-3 py-2.5 rounded-xl text-xs font-semibold transition-colors"
                  style={{ background: "var(--surface-elevated)", color: "var(--text-secondary)", border: "1px solid var(--surface-border)" }}
                >
                  <FolderKanban className="w-3.5 h-3.5" /> View Demo Project
                </Link>
              )}
            </div>
          </Section>

          <Section title="Details">
            <div className="space-y-3">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: "var(--text-muted)" }}>Source</div>
                <div className="text-xs capitalize" style={{ color: "var(--text-secondary)" }}>{lead.source.replace("_", " ")}</div>
              </div>
              <InfoRow label="Company Size" value={lead.companySize} />
              <InfoRow label="Region" value={lead.region} />
              {lead.demoGeneratedAt && (
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: "var(--text-muted)" }}>Demo Generated</div>
                  <div className="text-xs" style={{ color: "var(--text-secondary)" }}>{new Date(lead.demoGeneratedAt).toLocaleDateString()}</div>
                </div>
              )}
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: "var(--text-muted)" }}>Added</div>
                <div className="text-xs" style={{ color: "var(--text-secondary)" }}>{new Date(lead.createdAt).toLocaleDateString()}</div>
              </div>
            </div>
          </Section>

          {lead.notes && (
            <Section title="Notes">
              <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>{lead.notes}</p>
            </Section>
          )}

          {/* Danger zone */}
          <div className="rounded-xl p-4" style={{ border: "1px solid hsl(0 70% 60% / 0.2)" }}>
            <button
              onClick={() => {
                if (confirm("Delete this lead permanently?")) deleteMutation.mutate({ id: lead.id });
              }}
              disabled={deleteMutation.isPending}
              className="flex items-center gap-2 text-xs font-medium transition-opacity hover:opacity-70"
              style={{ color: "hsl(0, 70%, 60%)" }}
            >
              <Trash2 className="w-3.5 h-3.5" /> Delete Lead
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
