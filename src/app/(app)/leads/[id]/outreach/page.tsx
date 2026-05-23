"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/trpc/client";
import {
  ArrowLeft, Mail, MessageSquare, Phone, Link2,
  Loader2, Sparkles, Send, CheckCircle2, Copy, ChevronDown,
  BookmarkPlus, Bookmark, AlertCircle,
} from "lucide-react";

const CHANNELS = [
  { key: "email",    label: "Email",    icon: Mail,           description: "Compose and send a personalized email" },
  { key: "whatsapp", label: "WhatsApp", icon: MessageSquare,  description: "Generate a WhatsApp message" },
  { key: "sms",      label: "SMS",      icon: Phone,          description: "Generate a short SMS" },
  { key: "link",     label: "Share Link", icon: Link2,        description: "Generate a shareable link to the demo" },
] as const;

type Channel = typeof CHANNELS[number]["key"];

export default function OutreachPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const { data: lead, isLoading } = api.leads.get.useQuery({ id });
  const generateMessage = api.leads.generateMessage.useMutation();
  const [sendError, setSendError] = useState<string | null>(null);
  const sendOutreach = api.leads.sendOutreach.useMutation({
    onSuccess: (result) => {
      if (result.sentSuccessfully) {
        router.push(`/leads/${id}`);
      } else {
        setSendError(result.providerError ?? "Send failed — outreach recorded but not delivered.");
      }
    },
    onError: (err) => setSendError(err.message),
  });

  const [channel, setChannel] = useState<Channel>("email");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [templateName, setTemplateName] = useState("");

  const { data: templates = [], refetch: refetchTemplates } = api.outreachTemplates.list.useQuery({ channel });
  const createTemplate = api.outreachTemplates.create.useMutation({
    onSuccess: () => { setShowSaveTemplate(false); setTemplateName(""); void refetchTemplates(); },
  });

  function applyTemplate(templateId: string) {
    const t = templates.find((x) => x.id === templateId);
    if (!t) return;
    setSelectedTemplateId(templateId);
    if (t.subject) setSubject(t.subject);
    setMessage(t.body);
  }

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
      </div>
    );
  }

  const fullName = [lead.firstName, lead.lastName].filter(Boolean).join(" ") || lead.email || "Lead";

  async function handleGenerate() {
    const result = await generateMessage.mutateAsync({ leadId: id, channel });
    if (result.subject) setSubject(result.subject);
    setMessage(result.message);
  }

  function handleCopy() {
    const text = channel === "email" && subject ? `Subject: ${subject}\n\n${message}` : message;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleSend() {
    if (!message.trim() || !lead) return;
    setSendError(null);
    sendOutreach.mutate({
      leadId: id,
      channel,
      subject: subject || undefined,
      message,
      shareLink: lead.demoUrl ?? undefined,
      templateId: selectedTemplateId ?? undefined,
    });
  }

  function handleSaveTemplate() {
    if (!templateName.trim() || !message.trim()) return;
    createTemplate.mutate({
      name: templateName.trim(),
      channel,
      subject: subject || undefined,
      body: message,
      industry: lead?.industry || undefined,
      isActive: true,
    });
  }

  function handleWhatsApp() {
    if (!lead) return;
    const text = encodeURIComponent(message);
    const phone = lead.phone?.replace(/\D/g, "");
    window.open(phone ? `https://wa.me/${phone}?text=${text}` : `https://wa.me/?text=${text}`, "_blank");
  }

  const selectedChannel = CHANNELS.find((c) => c.key === channel)!;

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <Link href={`/leads/${id}`} className="flex items-center gap-1.5 text-sm transition-opacity hover:opacity-70" style={{ color: "var(--text-secondary)" }}>
          <ArrowLeft className="w-3.5 h-3.5" /> {fullName}
        </Link>
        <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Send Outreach</span>
      </div>

      {/* Channel picker */}
      <div className="grid grid-cols-4 gap-2 mb-6">
        {CHANNELS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => { setChannel(key); setMessage(""); setSubject(""); }}
            className="flex flex-col items-center gap-1.5 p-3 rounded-xl text-xs font-semibold transition-all"
            style={
              channel === key
                ? { background: "var(--brand-gradient)", color: "white" }
                : { background: "var(--surface-card)", color: "var(--text-secondary)", border: "1px solid var(--surface-border)" }
            }
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Lead context pill */}
      <div
        className="flex items-center gap-3 px-4 py-3 rounded-xl mb-6"
        style={{ background: "var(--surface-card)", border: "1px solid var(--surface-border)" }}
      >
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold shrink-0"
          style={{ background: "var(--brand-gradient)", color: "white" }}
        >
          {fullName.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{fullName}</div>
          <div className="text-xs" style={{ color: "var(--text-muted)" }}>
            {[lead.jobTitle, lead.company].filter(Boolean).join(" · ") || "No company info"}
          </div>
        </div>
        {lead.demoUrl && (
          <a
            href={lead.demoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-medium px-2.5 py-1 rounded-lg transition-opacity hover:opacity-80"
            style={{ background: "hsl(220 90% 62% / 0.1)", color: "var(--brand-primary)" }}
          >
            View Demo
          </a>
        )}
      </div>

      {/* Template picker */}
      {templates.length > 0 && (
        <div
          className="rounded-xl p-3 mb-3 flex items-center gap-3"
          style={{ background: "var(--surface-card)", border: "1px solid var(--surface-border)" }}
        >
          <Bookmark className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-muted)" }} />
          <select
            value={selectedTemplateId ?? ""}
            onChange={(e) => e.target.value ? applyTemplate(e.target.value) : setSelectedTemplateId(null)}
            className="flex-1 px-2 py-1.5 rounded-lg text-xs"
            style={{ background: "var(--surface-elevated)", border: "1px solid var(--surface-border)", color: "var(--text-primary)" }}
          >
            <option value="">Pick a template…</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} {t.useCount > 0 ? `· used ${t.useCount}×${t.wonCount > 0 ? ` · ${t.wonCount} won` : ""}` : ""}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Send error banner */}
      {sendError && (
        <div
          className="flex items-start gap-2 px-4 py-3 rounded-xl mb-3 text-sm"
          style={{ background: "hsl(0 72% 58% / 0.1)", border: "1px solid hsl(0 72% 58% / 0.3)", color: "hsl(0 72% 68%)" }}
        >
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold mb-0.5">Send failed</div>
            <div className="text-xs opacity-90">{sendError}</div>
            <div className="text-[11px] opacity-70 mt-1">
              The outreach was logged but not delivered. Check your provider config (Resend / Twilio).
            </div>
          </div>
        </div>
      )}

      {/* Compose area */}
      <div
        className="rounded-2xl p-6 space-y-4"
        style={{ background: "var(--surface-card)", border: "1px solid var(--surface-border)" }}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            {selectedChannel.label} message
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSaveTemplate(true)}
              disabled={!message.trim()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-opacity hover:opacity-80 disabled:opacity-30"
              style={{ background: "var(--surface-elevated)", color: "var(--text-secondary)", border: "1px solid var(--surface-border)" }}
              title="Save current message as a reusable template"
            >
              <BookmarkPlus className="w-3.5 h-3.5" />
              Save template
            </button>
            <button
              onClick={handleGenerate}
              disabled={generateMessage.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-opacity hover:opacity-80 disabled:opacity-50"
              style={{ background: "hsl(262 83% 68% / 0.12)", color: "hsl(262, 83%, 68%)" }}
            >
              {generateMessage.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              {generateMessage.isPending ? "Generating…" : "Generate with AI"}
            </button>
          </div>
        </div>

        {showSaveTemplate && (
          <div className="rounded-xl p-3 space-y-2" style={{ background: "var(--surface-elevated)", border: "1px solid var(--surface-border)" }}>
            <input
              type="text"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="Template name (e.g. 'Cold opener — HVAC')"
              className="w-full px-3 py-2 rounded-lg text-xs outline-none"
              style={{ background: "var(--surface-card)", border: "1px solid var(--surface-border)", color: "var(--text-primary)" }}
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={() => { setShowSaveTemplate(false); setTemplateName(""); }}
                className="px-3 py-1.5 rounded-lg text-xs"
                style={{ background: "var(--surface-card)", color: "var(--text-secondary)" }}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveTemplate}
                disabled={!templateName.trim() || createTemplate.isPending}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-50"
                style={{ background: "var(--brand-gradient)" }}
              >
                {createTemplate.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <BookmarkPlus className="w-3 h-3" />}
                Save
              </button>
            </div>
          </div>
        )}

        {channel === "email" && (
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--text-muted)" }}>
              Subject
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Email subject…"
              className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
              style={{ background: "var(--surface-elevated)", border: "1px solid var(--surface-border)", color: "var(--text-primary)" }}
            />
          </div>
        )}

        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--text-muted)" }}>
            Message
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={
              channel === "email"
                ? "Write your email here, or click Generate with AI…"
                : channel === "whatsapp"
                ? "Write your WhatsApp message…"
                : channel === "sms"
                ? "Keep it under 160 chars…"
                : "Write a message to go with the link…"
            }
            rows={channel === "email" ? 10 : 5}
            className="w-full px-3 py-2.5 rounded-xl text-sm outline-none resize-none"
            style={{ background: "var(--surface-elevated)", border: "1px solid var(--surface-border)", color: "var(--text-primary)" }}
          />
          {channel === "sms" && message.length > 0 && (
            <div className="text-right mt-1 text-[11px]" style={{ color: message.length > 160 ? "hsl(0, 70%, 60%)" : "var(--text-muted)" }}>
              {message.length}/160
            </div>
          )}
        </div>

        {lead.demoUrl && channel !== "sms" && (
          <div
            className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
            style={{ background: "hsl(142 68% 52% / 0.08)", border: "1px solid hsl(142 68% 52% / 0.2)" }}
          >
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" style={{ color: "hsl(142, 68%, 52%)" }} />
            <span className="text-xs flex-1 truncate" style={{ color: "var(--text-secondary)" }}>Demo: {lead.demoUrl}</span>
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex gap-3 mt-6 justify-end">
        <button
          onClick={handleCopy}
          disabled={!message}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-40"
          style={{ background: "var(--surface-elevated)", color: "var(--text-secondary)", border: "1px solid var(--surface-border)" }}
        >
          {copied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          {copied ? "Copied!" : "Copy"}
        </button>

        {channel === "whatsapp" && (
          <button
            onClick={handleWhatsApp}
            disabled={!message}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
            style={{ background: "#25D366" }}
          >
            <MessageSquare className="w-4 h-4" /> Open in WhatsApp
          </button>
        )}

        {channel === "email" && lead.email && (
          <a
            href={`mailto:${lead.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ background: "var(--brand-gradient)" }}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Mail className="w-4 h-4" /> Open in Mail
          </a>
        )}

        <button
          onClick={handleSend}
          disabled={!message || sendOutreach.isPending}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
          style={{ background: "var(--brand-gradient)" }}
        >
          {sendOutreach.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          {sendOutreach.isPending ? "Saving…" : "Log as Sent"}
        </button>
      </div>
    </div>
  );
}
