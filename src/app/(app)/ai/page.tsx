"use client";

import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { api } from "@/lib/trpc/client";
import {
  Send, Plus, Loader2, Sparkles, ChevronRight,
  Brain, Shield, Zap, Code, BarChart2, DollarSign, FileText,
  Trash2, MessageSquare, Bot,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { renderMarkdown } from "@/lib/markdown";

const MODES = [
  { id: "general",      label: "General",      icon: Brain,       desc: "Ask anything — full second brain context",           color: "hsl(220, 90%, 62%)" },
  { id: "architect",    label: "Architect",     icon: Zap,         desc: "System design & architecture decisions",             color: "hsl(262, 83%, 68%)" },
  { id: "tech_advisor", label: "Tech Advisor",  icon: Code,        desc: "Stack recommendations & technology choices",         color: "hsl(142, 68%, 52%)" },
  { id: "code_review",  label: "Code Review",   icon: FileText,    desc: "Review code for bugs, security & performance",       color: "hsl(207, 90%, 60%)" },
  { id: "security",     label: "Security",      icon: Shield,      desc: "Security audit & vulnerability assessment",          color: "hsl(0, 72%, 58%)" },
  { id: "performance",  label: "Performance",   icon: BarChart2,   desc: "Identify & fix performance bottlenecks",             color: "hsl(35, 90%, 58%)" },
  { id: "estimator",    label: "Estimator",     icon: DollarSign,  desc: "Accurate project estimates with risk buffers",       color: "hsl(50, 80%, 50%)" },
  { id: "scope_writer", label: "Scope Writer",  icon: MessageSquare, desc: "Write professional client scope documents",      color: "hsl(315, 70%, 60%)" },
] as const;

type Mode = (typeof MODES)[number]["id"];

function MessageBubble({ role, content, snippets }: { role: string; content: string; snippets?: number }) {
  const isUser = role === "user";
  return (
    <div className={cn("flex gap-3", isUser ? "flex-row-reverse" : "flex-row")}>
      <div
        className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold"
        style={
          isUser
            ? { background: "var(--brand-gradient)", color: "white" }
            : { background: "hsl(262 83% 68% / 0.2)", color: "hsl(262, 83%, 68%)" }
        }
      >
        {isUser ? "Y" : <Bot className="w-3.5 h-3.5" />}
      </div>
      <div className={cn("flex-1 max-w-[85%]", isUser ? "items-end" : "items-start")} style={{ display: "flex", flexDirection: "column" }}>
        {!isUser && snippets != null && snippets > 0 && (
          <div
            className="flex items-center gap-1 text-[10px] font-medium mb-1.5 px-2 py-0.5 rounded-full w-fit"
            style={{ background: "hsl(262 83% 68% / 0.1)", color: "hsl(262, 83%, 68%)" }}
          >
            <Sparkles className="w-2.5 h-2.5" />
            {snippets} second brain snippets used
          </div>
        )}
        <div
          className={cn(
            "rounded-2xl px-4 py-3 text-sm leading-relaxed",
            isUser ? "rounded-tr-sm" : "rounded-tl-sm",
          )}
          style={
            isUser
              ? { background: "var(--brand-primary)", color: "white" }
              : { background: "var(--surface-card)", color: "var(--text-primary)", border: "1px solid var(--surface-border)" }
          }
        >
          {isUser ? (
            <p style={{ whiteSpace: "pre-wrap" }}>{content}</p>
          ) : (
            <div
              className="prose-nexoflow"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function AiStudioInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const utils = api.useUtils();

  const [activeConvoId, setActiveConvoId] = useState<string>("");
  const [selectedMode, setSelectedMode] = useState<Mode>("general");
  const [input, setInput] = useState(searchParams.get("prefill") ?? "");
  const [streaming, setStreaming] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [streamSnippets, setStreamSnippets] = useState(0);
  const [localMessages, setLocalMessages] = useState<Array<{ role: string; content: string; snippets?: number }>>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { data: conversations = [] } = api.ai.listConversations.useQuery();
  const { data: activeConvo } = api.ai.getConversation.useQuery(
    { id: activeConvoId },
    { enabled: !!activeConvoId },
  );
  const createConvo = api.ai.createConversation.useMutation();
  const deleteConvo = api.ai.deleteConversation.useMutation({
    onSuccess: () => { void utils.ai.listConversations.invalidate(); setActiveConvoId(""); },
  });

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [localMessages, streamText]);

  // Sync messages from DB when conversation loads
  useEffect(() => {
    if (activeConvo?.messages) {
      setLocalMessages(activeConvo.messages.map((m) => ({
        role: m.role,
        content: m.content,
        snippets: m.contextSnippets ?? 0,
      })));
    }
  }, [activeConvo?.messages]);

  const startNewConvo = useCallback(async (mode: Mode) => {
    const convo = await createConvo.mutateAsync({ mode });
    if (convo) {
      setActiveConvoId(convo.id);
      setLocalMessages([]);
      setSelectedMode(mode);
      void utils.ai.listConversations.invalidate();
    }
  }, [createConvo, utils]);

  const send = useCallback(async () => {
    if (!input.trim() || streaming) return;

    let convoId = activeConvoId;
    if (!convoId) {
      const convo = await createConvo.mutateAsync({ mode: selectedMode });
      if (!convo) return;
      convoId = convo.id;
      setActiveConvoId(convoId);
      void utils.ai.listConversations.invalidate();
    }

    const userMsg = input.trim();
    setInput("");
    setLocalMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setStreaming(true);
    setStreamText("");
    setStreamSnippets(0);

    try {
      const res = await fetch(`/api/ai/${convoId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMsg }),
      });

      if (!res.ok) throw new Error(await res.text());

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error("No response body");

      let accumulated = "";
      let snippetCount = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split("\n")) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6)) as { text?: string; done?: boolean; error?: string; snippets?: number };
            if (data.error) throw new Error(data.error);
            if (data.snippets != null) { snippetCount = data.snippets; setStreamSnippets(data.snippets); }
            if (data.text) { accumulated += data.text; setStreamText(accumulated); }
            if (data.done) {
              setLocalMessages((prev) => [...prev, { role: "assistant", content: accumulated, snippets: snippetCount }]);
              setStreamText("");
              void utils.ai.getConversation.invalidate({ id: convoId });
              void utils.ai.listConversations.invalidate();
            }
          } catch (e) {
            if (e instanceof SyntaxError) continue;
            throw e;
          }
        }
      }
    } catch (err) {
      setLocalMessages((prev) => [...prev, { role: "assistant", content: `Error: ${err instanceof Error ? err.message : "Unknown error"}` }]);
    } finally {
      setStreaming(false);
      setStreamText("");
    }
  }, [input, streaming, activeConvoId, selectedMode, createConvo, utils]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  };

  const displayMessages = localMessages;
  const activeMode = MODES.find((m) => m.id === selectedMode)!;

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside
        className="w-64 shrink-0 flex flex-col"
        style={{ borderRight: "1px solid var(--surface-border)", background: "var(--surface-card)" }}
      >
        <div className="p-3 shrink-0" style={{ borderBottom: "1px solid var(--surface-border)" }}>
          <button
            onClick={() => { setActiveConvoId(""); setLocalMessages([]); }}
            className="flex items-center gap-2 w-full px-3 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ background: "var(--brand-gradient)" }}
          >
            <Plus className="w-4 h-4" /> New Chat
          </button>
        </div>

        {/* Mode selector */}
        <div className="p-3 shrink-0" style={{ borderBottom: "1px solid var(--surface-border)" }}>
          <p className="text-[10px] font-semibold uppercase tracking-wider px-1 mb-2" style={{ color: "var(--text-muted)" }}>Mode</p>
          <div className="space-y-0.5">
            {MODES.map((m) => {
              const Icon = m.icon;
              const active = selectedMode === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => { setSelectedMode(m.id); if (!activeConvoId) return; }}
                  className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs transition-all"
                  style={
                    active
                      ? { background: `${m.color}18`, color: m.color }
                      : { color: "var(--text-secondary)" }
                  }
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  {m.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Conversation history */}
        <div className="flex-1 overflow-auto p-2">
          {conversations.length > 0 && (
            <p className="text-[10px] font-semibold uppercase tracking-wider px-2 mb-2 mt-1" style={{ color: "var(--text-muted)" }}>History</p>
          )}
          {conversations.map((c) => {
            const mode = MODES.find((m) => m.id === c.mode);
            const lastMsg = c.messages[0];
            return (
              <div
                key={c.id}
                className={cn(
                  "group flex items-start gap-2 px-2.5 py-2 rounded-lg cursor-pointer transition-all",
                  activeConvoId === c.id ? "bg-white/5" : "hover:bg-white/[0.03]",
                )}
                onClick={() => setActiveConvoId(c.id)}
              >
                <div className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ background: mode?.color ?? "var(--text-muted)" }} />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium truncate" style={{ color: "var(--text-primary)" }}>{c.title}</div>
                  {lastMsg && (
                    <div className="text-[10px] truncate mt-0.5" style={{ color: "var(--text-muted)" }}>
                      {lastMsg.content.slice(0, 60)}
                    </div>
                  )}
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteConvo.mutate({ id: c.id }); }}
                  className="opacity-0 group-hover:opacity-100 p-0.5 rounded transition-opacity"
                  style={{ color: "var(--text-muted)" }}
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            );
          })}
        </div>
      </aside>

      {/* Chat area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mode indicator */}
        <div
          className="flex items-center gap-3 px-5 py-3 shrink-0"
          style={{ borderBottom: "1px solid var(--surface-border)", background: "var(--surface-card)" }}
        >
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: `${activeMode.color}18` }}
          >
            <activeMode.icon className="w-3.5 h-3.5" style={{ color: activeMode.color }} />
          </div>
          <div>
            <div className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{activeMode.label}</div>
            <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>{activeMode.desc}</div>
          </div>
          <div className="ml-auto flex items-center gap-1.5 text-[10px] font-medium px-2.5 py-1 rounded-full" style={{ background: "hsl(262 83% 68% / 0.1)", color: "hsl(262, 83%, 68%)" }}>
            <Sparkles className="w-2.5 h-2.5" />
            67,607 snippets in context
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-auto px-6 py-6 space-y-5">
          {displayMessages.length === 0 && !streamText ? (
            <div className="flex flex-col items-center justify-center h-full text-center max-w-lg mx-auto">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5"
                style={{ background: `${activeMode.color}15` }}
              >
                <activeMode.icon className="w-8 h-8" style={{ color: activeMode.color }} />
              </div>
              <h2 className="text-lg font-bold mb-2" style={{ color: "var(--text-primary)" }}>
                {activeMode.label}
              </h2>
              <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>
                {activeMode.desc}. Backed by NexoFlow's complete second brain — 67,607 snippets across 123 categories.
              </p>
              {/* Suggested prompts */}
              <div className="grid grid-cols-1 gap-2 w-full">
                {getSuggestedPrompts(selectedMode).map((p) => (
                  <button
                    key={p}
                    onClick={() => { setInput(p); textareaRef.current?.focus(); }}
                    className="text-left text-xs px-4 py-3 rounded-xl border transition-all hover:border-transparent"
                    style={{
                      background: "var(--surface-elevated)",
                      borderColor: "var(--surface-border)",
                      color: "var(--text-secondary)",
                    }}
                    onMouseOver={(e) => (e.currentTarget.style.background = `${activeMode.color}10`)}
                    onMouseOut={(e) => (e.currentTarget.style.background = "var(--surface-elevated)")}
                  >
                    <ChevronRight className="w-3 h-3 inline mr-1.5 opacity-50" />
                    {p}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {displayMessages.map((msg, i) => (
                <MessageBubble key={i} role={msg.role} content={msg.content} snippets={msg.snippets} />
              ))}
              {streamText && (
                <div className="flex gap-3">
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                    style={{ background: "hsl(262 83% 68% / 0.2)", color: "hsl(262, 83%, 68%)" }}
                  >
                    <Bot className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 max-w-[85%]">
                    {streamSnippets > 0 && (
                      <div className="flex items-center gap-1 text-[10px] font-medium mb-1.5 px-2 py-0.5 rounded-full w-fit" style={{ background: "hsl(262 83% 68% / 0.1)", color: "hsl(262, 83%, 68%)" }}>
                        <Sparkles className="w-2.5 h-2.5" />
                        {streamSnippets} snippets used
                      </div>
                    )}
                    <div
                      className="rounded-2xl rounded-tl-sm px-4 py-3 text-sm"
                      style={{ background: "var(--surface-card)", border: "1px solid var(--surface-border)", color: "var(--text-primary)" }}
                    >
                      <div className="prose-nexoflow" dangerouslySetInnerHTML={{ __html: renderMarkdown(streamText) }} />
                      <span className="inline-block w-1.5 h-4 bg-current opacity-70 ml-0.5 animate-pulse align-middle" />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Input */}
        <div
          className="p-4 shrink-0"
          style={{ borderTop: "1px solid var(--surface-border)", background: "var(--surface-card)" }}
        >
          <div
            className="flex items-end gap-3 rounded-2xl px-4 py-3"
            style={{ background: "var(--surface-elevated)", border: "1px solid var(--surface-border)" }}
          >
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Ask the ${activeMode.label} anything… (Enter to send, Shift+Enter for newline)`}
              rows={1}
              className="flex-1 bg-transparent text-sm resize-none outline-none leading-relaxed"
              style={{ color: "var(--text-primary)", maxHeight: "120px" }}
            />
            <button
              onClick={() => void send()}
              disabled={!input.trim() || streaming}
              className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-all disabled:opacity-30"
              style={{ background: "var(--brand-gradient)" }}
            >
              {streaming ? (
                <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5 text-white" />
              )}
            </button>
          </div>
          <p className="text-[10px] text-center mt-2" style={{ color: "var(--text-muted)" }}>
            Responses use relevant snippets from the NexoFlow second brain. Review before sharing with clients.
          </p>
        </div>
      </div>
    </div>
  );
}

function getSuggestedPrompts(mode: Mode): string[] {
  const prompts: Record<Mode, string[]> = {
    general:      ["What's the best way to handle auth in a Next.js SaaS app?", "Explain CAP theorem and when I'd choose CP vs AP", "What are the most common mistakes in REST API design?"],
    architect:    ["Design a multi-tenant SaaS architecture for a £40K project", "How should I structure a Next.js monorepo with shared packages?", "What's the right database architecture for a marketplace with high read volume?"],
    tech_advisor: ["What stack should I use for a React Native app with offline sync?", "Postgres vs MongoDB for a real-time collaboration tool?", "Should I use tRPC or REST for a mobile app backend?"],
    code_review:  ["Review this Drizzle ORM query for N+1 issues: [paste code]", "Is this auth middleware secure? [paste code]", "Review this React component for performance issues: [paste code]"],
    security:     ["What are the most common Next.js security vulnerabilities I should check?", "How do I properly implement RBAC in a multi-tenant app?", "Review my authentication flow for security issues: [paste code]"],
    performance:  ["My Next.js page has a 4s LCP — where do I start?", "How do I identify and fix N+1 queries in Drizzle ORM?", "What's the most impactful thing I can do to speed up a Postgres query?"],
    estimator:    ["Estimate a job board SaaS MVP with employer and candidate portals", "How long to build a React Native app with push notifications and offline sync?", "Estimate a multi-tenant project management tool similar to Asana"],
    scope_writer: ["Write a scope document for a dental practice booking system", "Create a scope for a B2B invoice management SaaS", "Draft a scope for an e-commerce platform with Shopify integration"],
  };
  return prompts[mode] ?? prompts.general!;
}

export default function AiStudioPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-5 h-5 animate-spin" style={{ color: "var(--text-muted)" }} />
      </div>
    }>
      <AiStudioInner />
    </Suspense>
  );
}
