/**
 * POST /api/webhooks/resend
 * Handles Resend email event webhooks — tracks opens and clicks on lead outreach emails.
 * Configure in Resend dashboard: Webhooks → email.opened, email.clicked
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
  const emailId = data?.email_id as string | undefined;

  if (!emailId) return NextResponse.json({ ok: true });

  if (type === "email.opened") {
    await db
      .update(leadOutreach)
      .set({ openedAt: new Date() })
      .where(eq(leadOutreach.id, emailId))
      .catch(() => null);
  }

  if (type === "email.clicked") {
    await db
      .update(leadOutreach)
      .set({ clickedAt: new Date() })
      .where(eq(leadOutreach.id, emailId))
      .catch(() => null);

    // When they click the demo link, advance lead to "replied"
    const outreach = await db.query.leadOutreach.findFirst({
      where: eq(leadOutreach.id, emailId),
    });
    if (outreach?.leadId) {
      await db
        .update(leads)
        .set({ status: "replied", updatedAt: new Date() })
        .where(eq(leads.id, outreach.leadId));
    }
  }

  return NextResponse.json({ ok: true });
}
