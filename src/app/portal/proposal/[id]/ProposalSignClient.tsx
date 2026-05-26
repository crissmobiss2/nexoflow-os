"use client";

import { useState } from "react";
import { api } from "@/lib/trpc/client";
import { FileSignature, CheckCircle } from "lucide-react";

export default function ProposalSignClient({
  proposalId,
  alreadySigned,
  signerName,
  signerEmail,
  signedAt,
  leadName,
}: {
  proposalId: string;
  alreadySigned: boolean;
  signerName?: string;
  signerEmail?: string;
  signedAt?: string;
  leadName: string;
}) {
  const [name, setName] = useState(signerName ?? leadName);
  const [email, setEmail] = useState(signerEmail ?? "");
  const [agreed, setAgreed] = useState(false);
  const [signed, setSigned] = useState(alreadySigned);
  const [signedInfo, setSignedInfo] = useState({ name: signerName ?? "", email: signerEmail ?? "", at: signedAt ?? "" });

  const signMutation = api.proposals.sign.useMutation({
    onSuccess: (data) => {
      setSigned(true);
      setSignedInfo({ name: data?.signerName ?? name, email: data?.signerEmail ?? email, at: data?.signedAt?.toString() ?? new Date().toISOString() });
    },
  });

  if (signed) {
    return (
      <div style={{ background: "#111118", border: "1px solid #22c55e33", borderRadius: 14, padding: "32px", textAlign: "center" }}>
        <div style={{ width: 52, height: 52, borderRadius: "50%", background: "#22c55e1a", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
          <CheckCircle style={{ width: 26, height: 26, color: "#22c55e" }} />
        </div>
        <div style={{ fontSize: 18, fontWeight: 700, color: "#e2e8f0", marginBottom: 8 }}>Proposal Signed</div>
        <div style={{ fontSize: 13, color: "#555", marginBottom: 4 }}>Signed by <strong style={{ color: "#e2e8f0" }}>{signedInfo.name}</strong></div>
        <div style={{ fontSize: 12, color: "#444" }}>{signedInfo.email}</div>
        {signedInfo.at && (
          <div style={{ fontSize: 11, color: "#333", marginTop: 8 }}>
            {new Date(signedInfo.at).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })}
          </div>
        )}
        <div style={{ marginTop: 20, padding: "12px 20px", background: "#0a0a0f", borderRadius: 10, display: "inline-block" }}>
          <div style={{ fontSize: 11, color: "#555" }}>Signature ID: <code style={{ color: "#a78bfa", fontSize: 10 }}>{proposalId.slice(0, 16)}…</code></div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: "#111118", border: "1px solid #1e1e2e", borderRadius: 14, padding: "28px 32px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
        <FileSignature style={{ width: 20, height: 20, color: "#a78bfa" }} />
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#e2e8f0" }}>Sign this Proposal</div>
          <div style={{ fontSize: 12, color: "#555" }}>Your electronic signature constitutes a legally binding agreement</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: "#555", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6 }}>Full Name *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your full name"
            style={{ width: "100%", background: "#0a0a0f", border: "1px solid #1e1e2e", borderRadius: 8, padding: "10px 14px", color: "#e2e8f0", fontSize: 13, outline: "none", boxSizing: "border-box" }}
          />
        </div>
        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: "#555", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6 }}>Email Address *</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            style={{ width: "100%", background: "#0a0a0f", border: "1px solid #1e1e2e", borderRadius: 8, padding: "10px 14px", color: "#e2e8f0", fontSize: 13, outline: "none", boxSizing: "border-box" }}
          />
        </div>
      </div>

      {/* Simulated signature area */}
      <div style={{ border: "1px dashed #1e1e2e", borderRadius: 10, padding: "20px", marginBottom: 14, textAlign: "center", background: "#0a0a0f", minHeight: 80 }}>
        {name ? (
          <div style={{ fontFamily: "cursive", fontSize: 32, color: "#a78bfa", lineHeight: 1.2 }}>{name}</div>
        ) : (
          <div style={{ color: "#333", fontSize: 13 }}>Your name will appear here as your signature</div>
        )}
        <div style={{ fontSize: 10, color: "#333", marginTop: 8 }}>Electronic Signature</div>
      </div>

      <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer", marginBottom: 20 }}>
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          style={{ marginTop: 2, accentColor: "#a78bfa", width: 16, height: 16 }}
        />
        <span style={{ fontSize: 12, color: "#888", lineHeight: 1.5 }}>
          I agree to the terms and conditions outlined in this proposal. I understand that by clicking "Sign Proposal"
          I am entering into a legally binding agreement with NexoFlow.
        </span>
      </label>

      <button
        disabled={!name.trim() || !email.trim() || !agreed || signMutation.isPending}
        onClick={() => signMutation.mutate({ id: proposalId, signerName: name.trim(), signerEmail: email.trim() })}
        style={{
          width: "100%",
          padding: "12px 24px",
          borderRadius: 10,
          background: !name.trim() || !email.trim() || !agreed ? "#1e1e2e" : "linear-gradient(135deg, #7c5cbf, #a855f7)",
          color: !name.trim() || !email.trim() || !agreed ? "#333" : "#fff",
          border: "none",
          cursor: !name.trim() || !email.trim() || !agreed || signMutation.isPending ? "not-allowed" : "pointer",
          fontSize: 14,
          fontWeight: 700,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
        }}
      >
        <FileSignature style={{ width: 16, height: 16 }} />
        {signMutation.isPending ? "Signing…" : "Sign Proposal"}
      </button>

      <div style={{ textAlign: "center", marginTop: 12, fontSize: 11, color: "#333" }}>
        Secured by NexoFlow · Your signature is timestamped and recorded
      </div>
    </div>
  );
}
