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
import { leadDemoViews, leads } from "@/server/db/schema";

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

    await db
      .update(leads)
      .set({
        demoViewCount: sql`${leads.demoViewCount} + 1`,
        demoTotalSeconds: sql`${leads.demoTotalSeconds} + ${seconds}`,
        demoLastViewedAt: now,
        updatedAt: now,
      })
      .where(eq(leads.id, leadId));
  }

  return NextResponse.json({ ok: true });
}
