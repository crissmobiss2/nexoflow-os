/**
 * POST /api/webhooks/booking
 * Generic booking webhook — compatible with Calendly (via Make.com/Zapier) and Cal.com.
 *
 * Expected payload:
 * {
 *   name: string,
 *   email: string,
 *   event_name?: string,       // "Discovery Call"
 *   scheduled_at?: string,     // ISO datetime
 *   invitee_uuid?: string,     // Calendly booking ID
 *   affiliate_code?: string,   // passed as UTM param via Calendly custom questions
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/server/db";
import { leads, leadCalls, affiliates, affiliateReferrals } from "@/server/db/schema";
import { sql } from "drizzle-orm";

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-webhook-secret");
  if (process.env.BOOKING_WEBHOOK_SECRET && secret !== process.env.BOOKING_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = (body.email as string)?.toLowerCase().trim();
  const name = (body.name as string) ?? "";
  const scheduledAt = body.scheduled_at as string | undefined;
  const bookingRef = (body.invitee_uuid ?? body.booking_id ?? body.uid) as string | undefined;
  const affiliateCode = body.affiliate_code as string | undefined;

  if (!email) return NextResponse.json({ error: "email required" }, { status: 400 });

  const nameParts = name.trim().split(" ");
  const firstName = nameParts[0] ?? "";
  const lastName = nameParts.slice(1).join(" ") || undefined;

  // Find or create lead
  let lead = await db.query.leads.findFirst({ where: eq(leads.email, email) });

  if (!lead) {
    const [created] = await db
      .insert(leads)
      .values({
        firstName,
        lastName,
        email,
        status: "new",
        source: "api",
        sourceDetail: "booking_webhook",
        bookingRef: bookingRef ?? null,
        affiliateCode: affiliateCode ?? null,
      })
      .returning();
    lead = created!;
  } else if (!lead.bookingRef && bookingRef) {
    await db.update(leads).set({ bookingRef, updatedAt: new Date() }).where(eq(leads.id, lead.id));
  }

  // Create call log
  await db.insert(leadCalls).values({
    leadId: lead.id,
    scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
    bookingRef: bookingRef ?? null,
    notes: `Booked via ${body.event_name ?? "discovery call"}`,
  });

  // Wire up affiliate referral if code provided
  if (affiliateCode && lead.id) {
    const affiliate = await db.query.affiliates.findFirst({
      where: and(eq(affiliates.referralCode, affiliateCode), eq(affiliates.status, "approved")),
    });
    if (affiliate) {
      const commissionPct = affiliate.tier === "gold" ? 15 : affiliate.tier === "silver" ? 12 : 10;
      await db.insert(affiliateReferrals).values({
        affiliateId: affiliate.id,
        leadId: lead.id,
        commissionPct,
      }).onConflictDoNothing();
      await db
        .update(affiliates)
        .set({ totalReferrals: sql`${affiliates.totalReferrals} + 1`, updatedAt: new Date() })
        .where(eq(affiliates.id, affiliate.id));
    }
  }

  return NextResponse.json({ ok: true, leadId: lead.id });
}
