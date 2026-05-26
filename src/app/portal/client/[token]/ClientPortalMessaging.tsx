"use client";

import { useState } from "react";
import { api } from "@/lib/trpc/client";
import { Send, MessageSquare } from "lucide-react";

type Message = {
  id: string;
  direction: string;
  authorName: string;
  content: string;
  createdAt: Date | string;
};

export default function ClientPortalMessaging({
  token,
  initialMessages,
  clientName,
}: {
  token: string;
  initialMessages: Message[];
  clientName: string;
}) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [text, setText] = useState("");
  const [name, setName] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const sendMutation = api.clientMessages.sendFromClient.useMutation({
    onSuccess: (msg) => {
      setMessages((prev) => [...prev, msg as Message]);
      setText("");
      setSent(true);
      setSending(false);
      setTimeout(() => setSent(false), 3000);
    },
    onError: () => setSending(false),
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setSending(true);
    sendMutation.mutate({ token, content: text.trim(), senderName: name.trim() || clientName });
  }

  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ fontSize: 11, color: "#555", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 14 }}>Messages</div>
      <div style={{ background: "#111118", border: "1px solid #1e1e2e", borderRadius: 14, overflow: "hidden" }}>
        {/* Message thread */}
        <div style={{ maxHeight: 320, overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
          {messages.length === 0 ? (
            <div style={{ textAlign: "center", color: "#444", fontSize: 13, padding: "20px 0" }}>
              <MessageSquare style={{ width: 24, height: 24, margin: "0 auto 8px", color: "#333" }} />
              No messages yet. Send us a message below.
            </div>
          ) : (
            messages.map((msg) => {
              const isFromTeam = msg.direction === "from_team";
              return (
                <div key={msg.id} style={{ display: "flex", flexDirection: "column", alignItems: isFromTeam ? "flex-start" : "flex-end" }}>
                  <div style={{ maxWidth: "75%", background: isFromTeam ? "#1e1e2e" : "#a78bfa1a", border: `1px solid ${isFromTeam ? "#2a2a40" : "#a78bfa33"}`, borderRadius: 12, padding: "10px 14px" }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: isFromTeam ? "#a78bfa" : "#60a5fa", marginBottom: 4 }}>{msg.authorName}</div>
                    <div style={{ fontSize: 13, color: "#e2e8f0", lineHeight: 1.5 }}>{msg.content}</div>
                  </div>
                  <div style={{ fontSize: 10, color: "#333", marginTop: 4 }}>
                    {new Date(msg.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Compose */}
        <div style={{ borderTop: "1px solid #1e1e2e", padding: "14px 20px" }}>
          <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <input
              type="text"
              placeholder="Your name (optional)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{ background: "#0a0a0f", border: "1px solid #1e1e2e", borderRadius: 8, padding: "8px 12px", color: "#e2e8f0", fontSize: 13, outline: "none" }}
            />
            <div style={{ display: "flex", gap: 10 }}>
              <textarea
                rows={2}
                placeholder="Type your message…"
                value={text}
                onChange={(e) => setText(e.target.value)}
                style={{ flex: 1, background: "#0a0a0f", border: "1px solid #1e1e2e", borderRadius: 8, padding: "8px 12px", color: "#e2e8f0", fontSize: 13, outline: "none", resize: "none" }}
              />
              <button
                type="submit"
                disabled={sending || !text.trim()}
                style={{ padding: "8px 16px", borderRadius: 8, background: sent ? "#22c55e1a" : "linear-gradient(135deg, #7c5cbf, #a855f7)", color: sent ? "#22c55e" : "#fff", border: "none", cursor: sending || !text.trim() ? "not-allowed" : "pointer", opacity: sending ? 0.7 : 1, display: "flex", alignItems: "center", gap: 6, fontWeight: 600, fontSize: 13, flexShrink: 0 }}
              >
                {sent ? "✓ Sent" : <><Send style={{ width: 14, height: 14 }} /> Send</>}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
