/**
 * POST /api/track/[leadId]
 *
 * Receives beacon pings from rendered demo pages. Upserts a leadDemoViews row
 * keyed on sessionId, and rolls up the lead's demo_view_count + demo_total_seconds.
 *
 * Body (JSON or text from sendBeacon):
 *   { sessionId, seconds, scroll, ctaClicks, referrer, closing }
 */

import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { leadDemoViews, leads, teamMembers, notifications } from "@/server/db/schema";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ leadId: string }> },
) {
  const { leadId } = await params;

  let body: { sessionId?: string; seconds?: number; scroll?: number; ctaClicks?: number; referrer?: string; closing?: boolean };
  try {
    const text = await req.text();
    body = text ? (JSON.parse(text) as typeof body) : {};
  } catch {
    return NextResponse.json({ ok: false, error: "invalid body" }, { status: 400 });
  }

  if (!body.sessionId) {
    return NextResponse.json({ ok: false, error: "missing sessionId" }, { status: 400 });
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? req.headers.get("x-real-ip") ?? "";
  const ipHash = ip ? createHash("sha256").update(ip).digest("hex").slice(0, 32) : null;
  const userAgent = req.headers.get("user-agent")?.slice(0, 500) ?? null;
  const now = new Date();

  const seconds = Math.max(0, Math.min(7200, Math.floor(body.seconds ?? 0)));
  const scroll = Math.max(0, Math.min(100, Math.floor(body.scroll ?? 0)));
  const ctaClicks = Math.max(0, Math.min(99, Math.floor(body.ctaClicks ?? 0)));

  // Upsert by (leadId, sessionId)
  const existing = await db.query.leadDemoViews.findFirst({
    where: and(eq(leadDemoViews.leadId, leadId), eq(leadDemoViews.sessionId, body.sessionId)),
  });

  if (existing) {
    const newSeconds = Math.max(existing.secondsOnPage, seconds);
    const newScroll = Math.max(existing.scrollDepthPct, scroll);
    const newCtaClicks = Math.max(existing.ctaClicks, ctaClicks);
    const secondsDelta = newSeconds - existing.secondsOnPage;
    await db
      .update(leadDemoViews)
      .set({
        secondsOnPage: newSeconds,
        scrollDepthPct: newScroll,
        ctaClicks: newCtaClicks,
        lastSeenAt: now,
      })
      .where(eq(leadDemoViews.id, existing.id));

    if (secondsDelta > 0) {
      await db
        .update(leads)
        .set({
          demoTotalSeconds: sql`${leads.demoTotalSeconds} + ${secondsDelta}`,
          demoLastViewedAt: now,
          updatedAt: now,
        })
        .where(eq(leads.id, leadId));
    }
  } else {
    await db.insert(leadDemoViews).values({
      leadId,
      sessionId: body.sessionId,
      referrer: body.referrer ?? null,
      userAgent,
      ipHash,
      secondsOnPage: seconds,
      scrollDepthPct: scroll,
      ctaClicks,
      firstSeenAt: now,
      lastSeenAt: now,
    });

    const updatedLead = await db
      .update(leads)
      .set({
        demoViewCount: sql`${leads.demoViewCount} + 1`,
        demoTotalSeconds: sql`${leads.demoTotalSeconds} + ${seconds}`,
        demoLastViewedAt: now,
        updatedAt: now,
      })
      .where(eq(leads.id, leadId))
      .returning({ teamId: leads.teamId, company: leads.company, firstName: leads.firstName, lastName: leads.lastName, demoViewCount: leads.demoViewCount });

    // Fire in-app notification to all team members on every new unique session view
    void (async () => {
      try {
        const lead = updatedLead[0];
        if (!lead?.teamId) return;
        const members = await db
          .select({ userId: teamMembers.userId })
          .from(teamMembers)
          .where(eq(teamMembers.teamId, lead.teamId));
        if (members.length === 0) return;
        const companyName = lead.company ?? [lead.firstName, lead.lastName].filter(Boolean).join(" ") ?? "A lead";
        const newViewCount = (lead.demoViewCount ?? 0) + 1; // +1 because returning() gives pre-update value
        const title = newViewCount <= 1
          ? `🔥 ${companyName} just viewed their demo for the first time`
          : `👀 ${companyName} viewed their demo again (${newViewCount} total views)`;
        await db.insert(notifications).values(
          members.map((m) => ({
            userId: m.userId,
            type: "demo_view" as const,
            title,
            message: "Call now — they are looking at it.",
            link: `/leads/${leadId}`,
            read: false,
          })),
        );
      } catch {
        /* non-fatal — never block the track response */
      }
    })();
  }

  return NextResponse.json({ ok: true });
}
