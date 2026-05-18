"use client";

import { useState } from "react";
import { signIn } from "@/lib/auth";
import { useRouter } from "next/navigation";

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const result = await signIn("resend", {
        email,
        redirect: false,
      });
      if (result?.error) {
        setError(result.error);
      } else {
        setSubmitted(true);
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: "var(--surface-ground, #0a0a0f)" }}
    >
      <div
        className="w-full max-w-sm mx-4 rounded-2xl p-8"
        style={{
          background: "var(--surface-card, #13131a)",
          border: "1px solid var(--surface-border, #22222e)",
        }}
      >
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center mb-3"
            style={{ background: "var(--brand-gradient, linear-gradient(135deg, #6366f1, #a855f7))" }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
          </div>
          <h1 className="text-xl font-bold" style={{ color: "var(--text-primary, #f1f1f7)" }}>
            NexoFlow OS
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted, #8888a0)" }}>
            Sign in with your email
          </p>
        </div>

        {submitted ? (
          <div className="text-center">
            <div className="w-14 h-14 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold mb-2" style={{ color: "var(--text-primary, #f1f1f7)" }}>
              Check your email
            </h2>
            <p className="text-sm mb-6" style={{ color: "var(--text-muted, #8888a0)" }}>
              A magic link has been sent to <br />
              <span className="font-medium" style={{ color: "var(--text-primary, #f1f1f7)" }}>{email}</span>
            </p>
            <button
              onClick={() => { setSubmitted(false); setEmail(""); }}
              className="text-sm font-medium transition-opacity hover:opacity-80"
              style={{ color: "var(--brand-primary, #6366f1)" }}
            >
              Use a different email
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-xs font-semibold uppercase tracking-wider mb-1.5"
                style={{ color: "var(--text-muted, #8888a0)" }}
              >
                Email address
              </label>
              <input
                id="email"
                type="email"
                required
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl text-sm outline-none transition-all duration-150"
                style={{
                  background: "var(--surface-ground, #0a0a0f)",
                  color: "var(--text-primary, #f1f1f7)",
                  border: "1px solid var(--surface-border, #22222e)",
                }}
              />
            </div>

            {error && (
              <div className="text-sm font-medium" style={{ color: "var(--color-red-400, #f87171)" }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity disabled:opacity-50"
              style={{ background: "var(--brand-gradient, linear-gradient(135deg, #6366f1, #a855f7))" }}
            >
              {loading ? "Sending..." : "Send magic link"}
            </button>

            <div className="text-center pt-2">
              <a
                href="/"
                className="text-xs font-medium transition-opacity hover:opacity-80"
                style={{ color: "var(--text-muted, #8888a0)" }}
              >
                &larr; Back to home
              </a>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
