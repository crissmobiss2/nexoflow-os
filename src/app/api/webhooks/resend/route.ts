/**
 * POST /api/webhooks/resend
 * Handles Resend email event webhooks — tracks opens and clicks on lead outreach emails.
 * Configure in Resend dashboard: Webhooks → email.delivered, email.opened, email.clicked, email.bounced, email.complained
 *
 * Matches on provider_message_id (the ID Resend returns from emails.send) — NOT
 * the local outreach row ID.
 */

import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { leadOutreach, leads } from "@/server/db/schema";

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const type = body.type as string;
  const data = body.data as Record<string, unknown> | undefined;
  const messageId = (data?.email_id as string | undefined) ?? (data?.id as string | undefined);

  if (!messageId) return NextResponse.json({ ok: true });

  // Find the outreach row by providerMessageId
  const outreach = await db.query.leadOutreach.findFirst({
    where: eq(leadOutreach.providerMessageId, messageId),
  });
  if (!outreach) {
    // Unknown message — ignore silently (likely sent outside our pipeline)
    return NextResponse.json({ ok: true, ignored: true });
  }

  switch (type) {
    case "email.delivered":
      await db.update(leadOutreach).set({ providerStatus: "delivered" }).where(eq(leadOutreach.id, outreach.id));
      break;
    case "email.opened":
      await db.update(leadOutreach).set({ openedAt: new Date(), providerStatus: "opened" }).where(eq(leadOutreach.id, outreach.id));
      break;
    case "email.clicked":
      await db.update(leadOutreach).set({ clickedAt: new Date(), providerStatus: "clicked" }).where(eq(leadOutreach.id, outreach.id));
      // Don't auto-advance to "replied" on click — a click is a click, not a reply.
      // We'll let inbound parsing or the user advance the status.
      break;
    case "email.bounced":
      await db.update(leadOutreach).set({ providerStatus: "bounced", providerError: (data?.bounce as Record<string, unknown> | undefined)?.message as string ?? "Bounced" }).where(eq(leadOutreach.id, outreach.id));
      break;
    case "email.complained":
      await db.update(leadOutreach).set({ providerStatus: "complained" }).where(eq(leadOutreach.id, outreach.id));
      // Auto-stop follow-ups for complained leads
      await db.update(leads).set({ status: "archived", updatedAt: new Date() }).where(eq(leads.id, outreach.leadId));
      break;
  }

  return NextResponse.json({ ok: true });
}
