"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });
      if (result?.error) {
        setError("Sign-in failed. Please try again.");
      } else {
        router.push("/");
        router.refresh();
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
          <img src="/nexoflow-logo.jpg" alt="NexoFlow" className="w-12 h-12 rounded-xl object-cover mb-3" />
          <h1 className="text-xl font-bold" style={{ color: "var(--text-primary, #f1f1f7)" }}>
            NexoFlow OS
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted, #8888a0)" }}>
            Enter your email to sign in
          </p>
        </div>

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

          <div>
            <label
              htmlFor="password"
              className="block text-xs font-semibold uppercase tracking-wider mb-1.5"
              style={{ color: "var(--text-muted, #8888a0)" }}
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
