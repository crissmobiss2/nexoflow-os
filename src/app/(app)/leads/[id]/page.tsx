"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/trpc/client";
import {
  ArrowLeft, ChevronRight, Globe, Mail, Phone, Building2, MapPin,
  Linkedin, Loader2, Sparkles, Zap, Send, ExternalLink, Tag, FolderKanban,
  ChevronDown, CheckCircle2, AlertCircle, Target, Trash2, Copy, Monitor, FileText,
  PhoneCall, Plus, Clock, Search, Palette, Eye, Award, Lock, Unlock, RotateCw, X,
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

  const [actionError, setActionError] = useState<string | null>(null);
  const { data: lead, isLoading, refetch } = api.leads.get.useQuery({ id });
  const updateMutation = api.leads.update.useMutation({
    onSuccess: () => refetch(),
    onError: (err) => setActionError(err.message),
  });
  const generateInsights = api.leads.generateInsights.useMutation({
    onSuccess: () => { refetch(); setActionError(null); },
    onError: (err) => setActionError(err.message),
  });
  const [copied, setCopied] = useState(false);
  const [copiedProposal, setCopiedProposal] = useState(false);
  const generateDemo = api.leads.generateDemo.useMutation({
    onSuccess: () => { refetch(); setActionError(null); },
    onError: (err) => setActionError(err.message),
  });
  const generateProposal = api.leads.generateProposal.useMutation({
    onSuccess: () => { refetch(); setActionError(null); },
    onError: (err) => setActionError(err.message),
  });

  function copyDemoLink(url: string) {
    void navigator.clipboard.writeText(window.location.origin + url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  function copyProposalLink(url: string) {
    void navigator.clipboard.writeText(window.location.origin + url);
    setCopiedProposal(true);
    setTimeout(() => setCopiedProposal(false), 2000);
  }
  const deleteMutation = api.leads.delete.useMutation({
    onSuccess: () => router.push("/leads"),
    onError: (err) => setActionError(err.message),
  });
  const scoreWithAi = api.leads.scoreWithAi.useMutation({
    onSuccess: () => { refetch(); setActionError(null); },
    onError: (err) => setActionError(err.message),
  });
  const enrichLead = api.leads.enrichLead.useMutation({
    onSuccess: () => { refetch(); setActionError(null); },
    onError: (err) => setActionError(err.message),
  });
  const [meetingNotes, setMeetingNotes] = useState("");
  const [showMeetingNotesInput, setShowMeetingNotesInput] = useState(false);
  const parseMeetingNotes = api.leads.parseMeetingNotes.useMutation({
    onSuccess: () => { refetch(); setShowMeetingNotesInput(false); setMeetingNotes(""); setActionError(null); },
    onError: (err) => setActionError(err.message),
  });
  const startFollowUp = api.leads.startFollowUpSequence.useMutation({
    onSuccess: () => { refetch(); setActionError(null); },
    onError: (err) => setActionError(err.message),
  });
  const scrapeLead = api.leads.scrapeLead.useMutation({
    onSuccess: () => { refetch(); setActionError(null); },
    onError: (err) => setActionError(err.message),
  });
  const generateBusinessProfile = api.leads.generateBusinessProfile.useMutation({
    onSuccess: () => { refetch(); setActionError(null); },
    onError: (err) => setActionError(err.message),
  });
  const rotateShareToken = api.leads.rotateShareToken.useMutation({
    onSuccess: () => { refetch(); setActionError(null); },
    onError: (err) => setActionError(err.message),
  });
  const revokeShare = api.leads.revokeShare.useMutation({
    onSuccess: () => { refetch(); setActionError(null); },
    onError: (err) => setActionError(err.message),
  });
  const recordOutcome = api.leads.recordOutcome.useMutation({
    onSuccess: () => { refetch(); setActionError(null); setShowOutcomeForm(false); },
    onError: (err) => setActionError(err.message),
  });
  const [showOutcomeForm, setShowOutcomeForm] = useState(false);
  const [outcomeForm, setOutcomeForm] = useState({ outcome: "won" as "won"|"lost"|"ghosted"|"not_a_fit"|"follow_up", valueUsd: "", notes: "" });
  const { data: proposalVersions } = api.leads.getProposalVersions.useQuery({ leadId: id });
  const { data: demoViews } = api.leads.getDemoViews.useQuery({ leadId: id });
  const { data: outcomes } = api.leads.getOutcomes.useQuery({ leadId: id });

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
      {actionError && (
        <div className="rounded-xl px-4 py-3 text-sm" style={{ background: "hsl(0 72% 58% / 0.1)", border: "1px solid hsl(0 72% 58% / 0.3)", color: "hsl(0 72% 68%)" }}>
          {actionError}
        </div>
      )}
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

          {/* Business Profile (new — from real scrape + Sonnet) */}
          {lead.businessProfile && (
            <div
              className="rounded-xl p-5"
              style={{ background: "hsl(207 90% 62% / 0.05)", border: "1px solid hsl(207 90% 62% / 0.2)" }}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Search className="w-4 h-4" style={{ color: "hsl(207, 90%, 62%)" }} />
                  <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "hsl(207, 90%, 62%)" }}>Business Profile</h3>
                </div>
                <button
                  onClick={() => generateBusinessProfile.mutate({ id: lead.id, forceScrape: true })}
                  disabled={generateBusinessProfile.isPending}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-opacity hover:opacity-80 disabled:opacity-50"
                  style={{ background: "hsl(207 90% 62% / 0.12)", color: "hsl(207, 90%, 62%)" }}
                >
                  {generateBusinessProfile.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCw className="w-3 h-3" />}
                  {generateBusinessProfile.isPending ? "Refreshing…" : "Refresh"}
                </button>
              </div>
              <div className="space-y-3">
                {lead.businessProfile.summary && (
                  <p className="text-sm leading-relaxed" style={{ color: "var(--text-primary)" }}>{lead.businessProfile.summary}</p>
                )}
                <div className="grid grid-cols-2 gap-3">
                  {lead.businessProfile.offer && (
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: "var(--text-muted)" }}>Their offer</div>
                      <div className="text-xs" style={{ color: "var(--text-secondary)" }}>{lead.businessProfile.offer}</div>
                    </div>
                  )}
                  {lead.businessProfile.targetCustomer && (
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: "var(--text-muted)" }}>Target customer</div>
                      <div className="text-xs" style={{ color: "var(--text-secondary)" }}>{lead.businessProfile.targetCustomer}</div>
                    </div>
                  )}
                  {lead.businessProfile.toneOfVoice && (
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: "var(--text-muted)" }}>Tone</div>
                      <div className="text-xs capitalize" style={{ color: "var(--text-secondary)" }}>{lead.businessProfile.toneOfVoice}</div>
                    </div>
                  )}
                  {lead.businessProfile.estimatedValue && (
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: "var(--text-muted)" }}>Est. value</div>
                      <div className="text-xs font-semibold" style={{ color: "hsl(142, 80%, 45%)" }}>{lead.businessProfile.estimatedValue}</div>
                    </div>
                  )}
                </div>
                {(lead.businessProfile.brandColors?.length ?? 0) > 0 && (
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>Brand palette</div>
                    <div className="flex gap-1.5">
                      {lead.businessProfile.brandColors!.map((c, i) => (
                        <div key={i} className="flex items-center gap-1.5">
                          <div className="w-6 h-6 rounded-md" style={{ background: c, border: "1px solid var(--surface-border)" }} />
                          <span className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>{c}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {(lead.businessProfile.visibleWeaknesses?.length ?? 0) > 0 && (
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--text-muted)" }}>Visible weaknesses</div>
                    <ul className="space-y-1">
                      {lead.businessProfile.visibleWeaknesses!.map((w, i) => (
                        <li key={i} className="flex items-start gap-1.5 text-xs" style={{ color: "var(--text-secondary)" }}>
                          <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" style={{ color: "hsl(35, 90%, 60%)" }} />
                          {w}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {(lead.businessProfile.buildOpportunities?.length ?? 0) > 0 && (
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--text-muted)" }}>Build opportunities</div>
                    <div className="space-y-2">
                      {lead.businessProfile.buildOpportunities!.map((o, i) => (
                        <div key={i} className="rounded-lg px-3 py-2" style={{ background: "var(--surface-elevated)" }}>
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>{o.title}</span>
                            <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>{o.effort}</span>
                          </div>
                          <p className="text-[11px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>{o.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {lead.businessProfile.demoAngle && (
                  <div className="rounded-lg px-3 py-2.5" style={{ background: "hsl(262 83% 68% / 0.06)", border: "1px solid hsl(262 83% 68% / 0.15)" }}>
                    <div className="text-[10px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: "hsl(262, 83%, 68%)" }}>Demo angle</div>
                    <p className="text-xs" style={{ color: "var(--text-secondary)" }}>{lead.businessProfile.demoAngle}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Scraped Profile fallback display */}
          {!lead.businessProfile && lead.scrapedProfile && (
            <div
              className="rounded-xl p-5"
              style={{ background: "hsl(207 90% 62% / 0.04)", border: "1px dashed hsl(207 90% 62% / 0.2)" }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Search className="w-4 h-4" style={{ color: "hsl(207, 90%, 62%)" }} />
                  <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                    Site scraped — ready to build profile
                  </span>
                </div>
                <button
                  onClick={() => generateBusinessProfile.mutate({ id: lead.id })}
                  disabled={generateBusinessProfile.isPending}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-opacity hover:opacity-80 disabled:opacity-50"
                  style={{ background: "hsl(207 90% 62% / 0.15)", color: "hsl(207, 90%, 62%)" }}
                >
                  {generateBusinessProfile.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  Build Business Profile
                </button>
              </div>
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
          {(lead.outreach?.length ?? 0) > 0 && (
            <Section title={`Outreach History (${lead.outreach?.length ?? 0})`}>
              <div className="space-y-2">
                {(lead.outreach ?? []).map((o) => (
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
                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                      {o.openedAt && (
                        <div className="flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" style={{ color: "hsl(142, 68%, 52%)" }} />
                          <span className="text-[11px]" style={{ color: "hsl(142, 68%, 52%)" }}>Opened {new Date(o.openedAt).toLocaleDateString()}</span>
                        </div>
                      )}
                      {(o as any).clickedAt && (
                        <div className="flex items-center gap-1">
                          <ExternalLink className="w-3 h-3" style={{ color: "hsl(207, 90%, 60%)" }} />
                          <span className="text-[11px]" style={{ color: "hsl(207, 90%, 60%)" }}>Clicked {new Date((o as any).clickedAt).toLocaleDateString()}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Call Log */}
          <CallLogSection leadId={lead.id} calls={(lead as any).calls ?? []} onRefetch={refetch} />
        </div>

        {/* Right sidebar */}
        <div className="space-y-4">
          {/* Research (scrape + profile) */}
          <Section title="Research">
            <div className="space-y-2">
              <button
                onClick={() => scrapeLead.mutate({ id: lead.id })}
                disabled={scrapeLead.isPending || !lead.website}
                className="flex items-center gap-2 w-full px-3 py-2.5 rounded-xl text-xs font-semibold transition-opacity hover:opacity-80 disabled:opacity-50"
                style={{ background: "hsl(207 90% 62% / 0.12)", color: "hsl(207, 90%, 62%)" }}
                title={!lead.website ? "Add a website to scrape" : ""}
              >
                {scrapeLead.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                {scrapeLead.isPending ? "Scraping website…" : lead.scrapedAt ? "Re-scrape Website" : "Scrape Website"}
              </button>
              <button
                onClick={() => generateBusinessProfile.mutate({ id: lead.id })}
                disabled={generateBusinessProfile.isPending}
                className="flex items-center gap-2 w-full px-3 py-2.5 rounded-xl text-xs font-semibold transition-opacity hover:opacity-80 disabled:opacity-50"
                style={{ background: "hsl(262 83% 68% / 0.12)", color: "hsl(262, 83%, 68%)" }}
              >
                {generateBusinessProfile.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Palette className="w-3.5 h-3.5" />}
                {generateBusinessProfile.isPending ? "Building profile…" : lead.businessProfile ? "Refresh Business Profile" : "Build Business Profile"}
              </button>
              {lead.scrapedAt && (
                <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                  Last scraped {new Date(lead.scrapedAt).toLocaleString()}
                </div>
              )}
            </div>
          </Section>

          {/* Demo Tracking */}
          {lead.demoUrl && (lead.demoViewCount ?? 0) > 0 && (
            <Section title="Demo Engagement">
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-lg px-2 py-2 text-center" style={{ background: "var(--surface-elevated)" }}>
                    <div className="text-base font-bold" style={{ color: "var(--text-primary)" }}>{lead.demoViewCount ?? 0}</div>
                    <div className="text-[9px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Views</div>
                  </div>
                  <div className="rounded-lg px-2 py-2 text-center" style={{ background: "var(--surface-elevated)" }}>
                    <div className="text-base font-bold" style={{ color: "var(--text-primary)" }}>
                      {Math.floor((lead.demoTotalSeconds ?? 0) / 60)}m{(lead.demoTotalSeconds ?? 0) % 60}s
                    </div>
                    <div className="text-[9px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Total</div>
                  </div>
                  <div className="rounded-lg px-2 py-2 text-center" style={{ background: "var(--surface-elevated)" }}>
                    <div className="text-base font-bold" style={{ color: "var(--text-primary)" }}>
                      {Math.max(...(demoViews ?? [{ scrollDepthPct: 0 }]).map((v) => v.scrollDepthPct), 0)}%
                    </div>
                    <div className="text-[9px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Scroll</div>
                  </div>
                </div>
                {(demoViews?.length ?? 0) > 0 && (
                  <div className="space-y-1.5">
                    {(demoViews ?? []).slice(0, 4).map((v) => (
                      <div key={v.id} className="flex items-center justify-between text-[11px]" style={{ color: "var(--text-secondary)" }}>
                        <span>{new Date(v.lastSeenAt).toLocaleString()}</span>
                        <span className="font-mono" style={{ color: "var(--text-muted)" }}>
                          {Math.floor(v.secondsOnPage / 60)}:{String(v.secondsOnPage % 60).padStart(2, "0")} · {v.scrollDepthPct}% · {v.ctaClicks} clk
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Section>
          )}

          {/* Share controls */}
          {lead.demoUrl && (
            <Section title="Share Link">
              <div className="space-y-2">
                {lead.shareRevokedAt ? (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs" style={{ background: "hsl(0 70% 60% / 0.1)", color: "hsl(0, 70%, 60%)" }}>
                    <Lock className="w-3.5 h-3.5" />
                    Revoked {new Date(lead.shareRevokedAt).toLocaleDateString()}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs" style={{ background: "hsl(142 68% 52% / 0.08)", color: "hsl(142, 68%, 52%)" }}>
                    <Unlock className="w-3.5 h-3.5" />
                    Live
                  </div>
                )}
                <button
                  onClick={() => rotateShareToken.mutate({ id: lead.id })}
                  disabled={rotateShareToken.isPending}
                  className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-xs font-semibold transition-opacity hover:opacity-80 disabled:opacity-50"
                  style={{ background: "var(--surface-elevated)", color: "var(--text-secondary)", border: "1px solid var(--surface-border)" }}
                >
                  <RotateCw className="w-3.5 h-3.5" /> Rotate token
                </button>
                <button
                  onClick={() => {
                    if (confirm("Revoke this demo share link? Anyone with the old link will see a 410.")) {
                      revokeShare.mutate({ id: lead.id });
                    }
                  }}
                  disabled={revokeShare.isPending || !!lead.shareRevokedAt}
                  className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-xs font-semibold transition-opacity hover:opacity-80 disabled:opacity-50"
                  style={{ background: "hsl(0 70% 60% / 0.1)", color: "hsl(0, 70%, 60%)" }}
                >
                  <Lock className="w-3.5 h-3.5" /> Revoke
                </button>
              </div>
            </Section>
          )}

          {/* Outcome capture */}
          <Section title="Outcome">
            {!showOutcomeForm ? (
              <button
                onClick={() => setShowOutcomeForm(true)}
                className="flex items-center gap-2 w-full px-3 py-2.5 rounded-xl text-xs font-semibold transition-opacity hover:opacity-80"
                style={{ background: "hsl(142 68% 52% / 0.1)", color: "hsl(142, 68%, 52%)" }}
              >
                <Award className="w-3.5 h-3.5" /> Record outcome
              </button>
            ) : (
              <div className="space-y-2">
                <select
                  value={outcomeForm.outcome}
                  onChange={(e) => setOutcomeForm((f) => ({ ...f, outcome: e.target.value as typeof outcomeForm.outcome }))}
                  className="w-full px-3 py-2 rounded-lg text-xs"
                  style={{ background: "var(--surface-elevated)", border: "1px solid var(--surface-border)", color: "var(--text-primary)" }}
                >
                  <option value="won">Won</option>
                  <option value="lost">Lost</option>
                  <option value="ghosted">Ghosted</option>
                  <option value="not_a_fit">Not a fit</option>
                  <option value="follow_up">Follow up later</option>
                </select>
                {outcomeForm.outcome === "won" && (
                  <input
                    type="number"
                    placeholder="Project value $"
                    value={outcomeForm.valueUsd}
                    onChange={(e) => setOutcomeForm((f) => ({ ...f, valueUsd: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg text-xs"
                    style={{ background: "var(--surface-elevated)", border: "1px solid var(--surface-border)", color: "var(--text-primary)" }}
                  />
                )}
                <textarea
                  placeholder="Notes (optional)"
                  rows={2}
                  value={outcomeForm.notes}
                  onChange={(e) => setOutcomeForm((f) => ({ ...f, notes: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg text-xs"
                  style={{ background: "var(--surface-elevated)", border: "1px solid var(--surface-border)", color: "var(--text-primary)", resize: "none" }}
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowOutcomeForm(false)}
                    className="flex-1 px-3 py-2 rounded-lg text-xs"
                    style={{ background: "var(--surface-elevated)", color: "var(--text-secondary)" }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => recordOutcome.mutate({
                      leadId: lead.id,
                      outcome: outcomeForm.outcome,
                      valueCents: outcomeForm.valueUsd ? Math.round(parseFloat(outcomeForm.valueUsd) * 100) : undefined,
                      notes: outcomeForm.notes || undefined,
                    })}
                    disabled={recordOutcome.isPending}
                    className="flex-1 px-3 py-2 rounded-lg text-xs font-semibold text-white disabled:opacity-50"
                    style={{ background: "var(--brand-gradient)" }}
                  >
                    {recordOutcome.isPending ? "Saving…" : "Save"}
                  </button>
                </div>
              </div>
            )}
            {(outcomes?.length ?? 0) > 0 && (
              <div className="mt-3 space-y-1.5">
                {(outcomes ?? []).slice(0, 3).map((o) => (
                  <div key={o.id} className="flex items-center justify-between text-[11px]" style={{ color: "var(--text-secondary)" }}>
                    <span className="capitalize">{o.outcome.replace("_", " ")}</span>
                    <span style={{ color: "var(--text-muted)" }}>
                      {o.valueCents ? `$${(o.valueCents / 100).toLocaleString()}` : ""} {new Date(o.capturedAt).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Section>

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
                {generateDemo.isPending ? "Building demo website…" : lead.demoUrl ? "Regenerate Demo" : "Build Demo Website"}
              </button>
              {lead.demoUrl && (
                <div
                  className="rounded-xl px-3 py-2.5 space-y-2"
                  style={{ background: "hsl(142 68% 52% / 0.06)", border: "1px solid hsl(142 68% 52% / 0.2)" }}
                >
                  <div className="flex items-center gap-1.5">
                    <Monitor className="w-3 h-3" style={{ color: "hsl(142, 68%, 52%)" }} />
                    <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "hsl(142, 68%, 52%)" }}>Demo Ready</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <a
                      href={lead.demoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs hover:underline flex-1 min-w-0"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      <ExternalLink className="w-3 h-3 shrink-0" />
                      <span className="truncate">View Live Demo</span>
                    </a>
                    <button
                      onClick={() => copyDemoLink(lead.demoUrl!)}
                      className="shrink-0 p-1 rounded-lg transition-opacity hover:opacity-70"
                      style={{ color: copied ? "hsl(142, 68%, 52%)" : "var(--text-muted)" }}
                      title="Copy demo link"
                    >
                      {copied ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              )}
              <button
                onClick={() => generateProposal.mutate({ id: lead.id })}
                disabled={generateProposal.isPending}
                className="flex items-center gap-2 w-full px-3 py-2.5 rounded-xl text-xs font-semibold transition-opacity hover:opacity-80 disabled:opacity-50"
                style={{ background: "hsl(207 90% 62% / 0.12)", color: "hsl(207, 90%, 62%)" }}
              >
                {generateProposal.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
                {generateProposal.isPending ? "Writing proposal…" : lead.proposalUrl ? "Regenerate Proposal" : "Generate Proposal"}
              </button>
              {lead.proposalUrl && (
                <div
                  className="rounded-xl px-3 py-2.5 space-y-2"
                  style={{ background: "hsl(207 90% 62% / 0.06)", border: "1px solid hsl(207 90% 62% / 0.2)" }}
                >
                  <div className="flex items-center gap-1.5">
                    <FileText className="w-3 h-3" style={{ color: "hsl(207, 90%, 62%)" }} />
                    <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "hsl(207, 90%, 62%)" }}>Proposal Ready</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <a
                      href={lead.proposalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs hover:underline flex-1 min-w-0"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      <ExternalLink className="w-3 h-3 shrink-0" />
                      <span className="truncate">View Proposal</span>
                    </a>
                    <button
                      onClick={() => copyProposalLink(lead.proposalUrl!)}
                      className="shrink-0 p-1 rounded-lg transition-opacity hover:opacity-70"
                      style={{ color: copiedProposal ? "hsl(207, 90%, 62%)" : "var(--text-muted)" }}
                      title="Copy proposal link"
                    >
                      {copiedProposal ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              )}
              {/* AI Score */}
              {lead.aiScore != null && (
                <div className="rounded-xl px-3 py-2 flex items-center justify-between" style={{ background: `hsl(${lead.aiScore >= 70 ? "142 68% 52%" : lead.aiScore >= 40 ? "35 90% 58%" : "0 72% 58%"} / 0.12)` }}>
                  <span className="text-xs font-semibold" style={{ color: `hsl(${lead.aiScore >= 70 ? "142 68% 52%" : lead.aiScore >= 40 ? "35 90% 58%" : "0 72% 58%"})` }}>
                    AI Score: {lead.aiScore}/100
                  </span>
                  {lead.aiScoreReason && <span className="text-[10px] ml-2 flex-1 text-right" style={{ color: "var(--text-muted)" }}>{lead.aiScoreReason}</span>}
                </div>
              )}
              <button
                onClick={() => scoreWithAi.mutate({ id: lead.id })}
                disabled={scoreWithAi.isPending}
                className="flex items-center gap-2 w-full px-3 py-2.5 rounded-xl text-xs font-semibold transition-opacity hover:opacity-80 disabled:opacity-50"
                style={{ background: "hsl(262 83% 68% / 0.12)", color: "hsl(262, 83%, 68%)" }}
              >
                {scoreWithAi.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                {scoreWithAi.isPending ? "Scoring…" : lead.aiScore != null ? "Re-score Lead" : "AI Score Lead"}
              </button>
              <button
                onClick={() => enrichLead.mutate({ id: lead.id })}
                disabled={enrichLead.isPending}
                className="flex items-center gap-2 w-full px-3 py-2.5 rounded-xl text-xs font-semibold transition-opacity hover:opacity-80 disabled:opacity-50"
                style={{ background: "hsl(35 90% 58% / 0.12)", color: "hsl(35, 90%, 58%)" }}
              >
                {enrichLead.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                {enrichLead.isPending ? "Enriching…" : lead.enrichedAt ? "Re-enrich Lead" : "Enrich with AI"}
              </button>
              <button
                onClick={() => setShowMeetingNotesInput((v) => !v)}
                className="flex items-center gap-2 w-full px-3 py-2.5 rounded-xl text-xs font-semibold transition-opacity hover:opacity-80"
                style={{ background: "hsl(207 90% 62% / 0.1)", color: "hsl(207, 90%, 62%)" }}
              >
                <FileText className="w-3.5 h-3.5" /> Parse Meeting Notes
              </button>
              {showMeetingNotesInput && (
                <div className="space-y-2">
                  <textarea
                    rows={4}
                    placeholder="Paste raw meeting notes here…"
                    value={meetingNotes}
                    onChange={(e) => setMeetingNotes(e.target.value)}
                    className="w-full rounded-xl px-3 py-2 text-xs"
                    style={{ background: "var(--surface-elevated)", border: "1px solid var(--surface-border)", color: "var(--text-primary)", resize: "vertical", outline: "none" }}
                  />
                  <button
                    onClick={() => parseMeetingNotes.mutate({ id: lead.id, notes: meetingNotes })}
                    disabled={parseMeetingNotes.isPending || meetingNotes.length < 10}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-white disabled:opacity-50"
                    style={{ background: "var(--brand-gradient)" }}
                  >
                    {parseMeetingNotes.isPending ? <><Loader2 className="w-3 h-3 animate-spin" /> Parsing…</> : "Extract & Save to CRM"}
                  </button>
                </div>
              )}
              <button
                onClick={() => startFollowUp.mutate({ leadId: lead.id })}
                disabled={startFollowUp.isPending || startFollowUp.isSuccess}
                className="flex items-center gap-2 w-full px-3 py-2.5 rounded-xl text-xs font-semibold transition-opacity hover:opacity-80 disabled:opacity-50"
                style={{ background: "hsl(142 68% 52% / 0.08)", color: "hsl(142, 68%, 52%)", border: "1px solid hsl(142 68% 52% / 0.2)" }}
              >
                <Send className="w-3.5 h-3.5" />
                {startFollowUp.isSuccess ? "✓ Follow-up Sequence Started" : "Start Follow-up Sequence"}
              </button>
              {/* Proposal Versions */}
              {proposalVersions && proposalVersions.length > 0 && (
                <div className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                  {proposalVersions.length} proposal version{proposalVersions.length !== 1 ? "s" : ""} · {proposalVersions.filter((v) => v.signedAt).length} signed
                </div>
              )}
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


// ─── Call Log Section ─────────────────────────────────────────────────────────

const OUTCOME_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  won:            { label: "Won",            color: "hsl(142, 80%, 45%)", bg: "hsl(142, 80%, 45%, 0.15)" },
  lost:           { label: "Lost",           color: "hsl(0, 70%, 60%)",   bg: "hsl(0, 70%, 60%, 0.12)"   },
  follow_up:      { label: "Follow Up",      color: "hsl(35, 90%, 60%)",  bg: "hsl(35, 90%, 60%, 0.12)"  },
  no_show:        { label: "No Show",        color: "hsl(220, 14%, 55%)", bg: "hsl(220, 14%, 55%, 0.12)" },
  not_interested: { label: "Not Interested", color: "hsl(0, 60%, 65%)",   bg: "hsl(0, 60%, 65%, 0.1)"    },
  rescheduled:    { label: "Rescheduled",    color: "hsl(262, 83%, 68%)", bg: "hsl(262, 83%, 68%, 0.12)" },
};

type CallLog = {
  id: string;
  scheduledAt?: Date | string | null;
  completedAt?: Date | string | null;
  outcome?: string | null;
  notes?: string | null;
  durationMinutes?: number | null;
  bookingRef?: string | null;
  createdAt: Date | string;
};

function CallLogSection({ leadId, calls, onRefetch }: { leadId: string; calls: CallLog[]; onRefetch: () => void }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ scheduledAt: "", outcome: "", notes: "", durationMinutes: "" });

  const addCall = api.leads.addCall.useMutation({
    onSuccess: () => { onRefetch(); setShowForm(false); setForm({ scheduledAt: "", outcome: "", notes: "", durationMinutes: "" }); },
  });

  return (
    <Section title={`Discovery Calls (${calls.length})`}>
      <div className="space-y-2">
        {calls.map((c) => {
          const outcomeCfg = c.outcome ? OUTCOME_CONFIG[c.outcome] : null;
          return (
            <div key={c.id} className="px-3 py-3 rounded-xl" style={{ background: "var(--surface-elevated)", border: "1px solid var(--surface-border-subtle)" }}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <PhoneCall className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
                  <span className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>
                    {c.scheduledAt ? new Date(c.scheduledAt).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "Call logged"}
                  </span>
                  {c.durationMinutes && (
                    <span className="flex items-center gap-0.5 text-[11px]" style={{ color: "var(--text-muted)" }}>
                      <Clock className="w-3 h-3" />{c.durationMinutes}m
                    </span>
                  )}
                </div>
                {outcomeCfg && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: outcomeCfg.bg, color: outcomeCfg.color }}>
                    {outcomeCfg.label}
                  </span>
                )}
              </div>
              {c.notes && <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>{c.notes}</p>}
            </div>
          );
        })}

        {!showForm ? (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 w-full px-3 py-2.5 rounded-xl text-xs font-semibold transition-opacity hover:opacity-80"
            style={{ border: "1px dashed var(--surface-border)", color: "var(--text-muted)" }}
          >
            <Plus className="w-3.5 h-3.5" /> Log a call
          </button>
        ) : (
          <div className="space-y-2.5 px-3 py-3 rounded-xl" style={{ background: "var(--surface-elevated)", border: "1px solid var(--surface-border)" }}>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>Scheduled At</label>
                <input type="datetime-local" value={form.scheduledAt} onChange={(e) => setForm((f) => ({ ...f, scheduledAt: e.target.value }))}
                  className="w-full px-2.5 py-2 rounded-lg text-xs outline-none" style={{ background: "var(--surface-card)", border: "1px solid var(--surface-border)", color: "var(--text-primary)" }} />
              </div>
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>Duration (min)</label>
                <input type="number" value={form.durationMinutes} onChange={(e) => setForm((f) => ({ ...f, durationMinutes: e.target.value }))} placeholder="30"
                  className="w-full px-2.5 py-2 rounded-lg text-xs outline-none" style={{ background: "var(--surface-card)", border: "1px solid var(--surface-border)", color: "var(--text-primary)" }} />
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>Outcome</label>
              <select value={form.outcome} onChange={(e) => setForm((f) => ({ ...f, outcome: e.target.value }))}
                className="w-full px-2.5 py-2 rounded-lg text-xs outline-none" style={{ background: "var(--surface-card)", border: "1px solid var(--surface-border)", color: "var(--text-primary)" }}>
                <option value="">Select outcome…</option>
                {Object.entries(OUTCOME_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>Notes</label>
              <textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={2} placeholder="What was discussed…"
                className="w-full px-2.5 py-2 rounded-lg text-xs outline-none resize-none" style={{ background: "var(--surface-card)", border: "1px solid var(--surface-border)", color: "var(--text-primary)" }} />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => addCall.mutate({ leadId, scheduledAt: form.scheduledAt || undefined, outcome: form.outcome as any || undefined, notes: form.notes || undefined, durationMinutes: form.durationMinutes ? Number(form.durationMinutes) : undefined })}
                disabled={addCall.isPending}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-white disabled:opacity-50"
                style={{ background: "var(--brand-gradient)" }}
              >
                {addCall.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />} Save Call
              </button>
              <button onClick={() => setShowForm(false)} className="px-3 py-2 rounded-lg text-xs font-semibold" style={{ background: "var(--surface-card)", color: "var(--text-secondary)", border: "1px solid var(--surface-border)" }}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </Section>
  );
}
