import Link from "next/link";
import { db } from "@/server/db";
import { leads } from "@/server/db/schema";
import { and, desc, eq, isNotNull } from "drizzle-orm";

export const revalidate = 300;

export const metadata = {
  title: "NexoFlow — Demo Wall",
  description: "A showcase of custom demos built by NexoFlow for clients we've worked with.",
};

export default async function ShowcasePage() {
  const rows = await db
    .select({
      id: leads.id,
      company: leads.company,
      industry: leads.industry,
      demoUrl: leads.demoUrl,
      shareToken: leads.shareToken,
      shareRevokedAt: leads.shareRevokedAt,
      businessProfile: leads.businessProfile,
      wonValueCents: leads.wonValueCents,
      demoGeneratedAt: leads.demoGeneratedAt,
    })
    .from(leads)
    .where(and(eq(leads.status, "won"), isNotNull(leads.demoUrl)))
    .orderBy(desc(leads.updatedAt))
    .limit(30);

  const visible = rows.filter((r) => !r.shareRevokedAt && r.demoUrl);

  return (
    <main style={{ minHeight: "100vh", background: "#0a0a0f", color: "#fff", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <header style={{ maxWidth: 1100, margin: "0 auto", padding: "64px 24px 32px" }}>
        <div style={{ marginBottom: 8, fontSize: 12, letterSpacing: 2, textTransform: "uppercase", color: "rgba(255,255,255,0.5)" }}>
          NexoFlow
        </div>
        <h1 style={{ fontSize: 48, fontWeight: 800, margin: "0 0 12px", letterSpacing: -1 }}>
          Demos we built. Clients we won.
        </h1>
        <p style={{ fontSize: 16, lineHeight: 1.6, color: "rgba(255,255,255,0.7)", maxWidth: 640, margin: 0 }}>
          Every demo below was custom-built in minutes from a scraped business profile, then closed.
          {" "}
          <Link href="https://nexoflow.tech" style={{ color: "#a78bfa", textDecoration: "none" }}>
            Want one for your business? →
          </Link>
        </p>
      </header>

      {visible.length === 0 ? (
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: 24 }}>
          <div style={{ padding: 48, textAlign: "center", color: "rgba(255,255,255,0.5)", border: "1px dashed rgba(255,255,255,0.1)", borderRadius: 16 }}>
            No demos to show yet — they appear here after a lead is marked as Won with a live demo link.
          </div>
        </div>
      ) : (
        <section
          style={{
            maxWidth: 1100,
            margin: "0 auto",
            padding: "0 24px 80px",
            display: "grid",
            gap: 20,
            gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
          }}
        >
          {visible.map((r) => {
            const colors = r.businessProfile?.brandColors ?? ["#7c5cbf", "#4f8ef7", "#0a0a0f"];
            const href = r.demoUrl ?? "#";
            return (
              <a
                key={r.id}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "block",
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 16,
                  padding: 20,
                  textDecoration: "none",
                  color: "inherit",
                  transition: "transform 200ms, border-color 200ms",
                }}
              >
                <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
                  {colors.slice(0, 3).map((c, i) => (
                    <div key={i} style={{ width: 28, height: 28, borderRadius: 6, background: c, border: "1px solid rgba(255,255,255,0.1)" }} />
                  ))}
                </div>
                <div style={{ fontSize: 11, letterSpacing: 1, textTransform: "uppercase", color: "rgba(255,255,255,0.5)", marginBottom: 4 }}>
                  {r.industry ?? "Project"}
                </div>
                <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>{r.company ?? "Anonymous client"}</div>
                {r.businessProfile?.offer && (
                  <div style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", lineHeight: 1.5, marginBottom: 12 }}>
                    {r.businessProfile.offer}
                  </div>
                )}
                <div style={{ fontSize: 12, color: "#a78bfa", display: "flex", alignItems: "center", gap: 4 }}>
                  View demo →
                </div>
              </a>
            );
          })}
        </section>
      )}

      <footer style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px 64px", color: "rgba(255,255,255,0.4)", fontSize: 12 }}>
        Built by NexoFlow · <Link href="https://nexoflow.tech" style={{ color: "rgba(255,255,255,0.6)" }}>nexoflow.tech</Link>
      </footer>
    </main>
  );
}
