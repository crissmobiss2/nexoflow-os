/**
 * POST /api/webhooks/resend-inbound
 *
 * Receives inbound email replies from Resend (or any provider that posts a
 * JSON payload with from, to, subject, text). When a reply matches a lead
 * (by sender email), we:
 *   - Mark the related outreach row as replied (most recent matching row)
 *   - Move the lead status to "replied"
 *   - Pause any active follow-up sequences
 *   - Classify the reply intent (interested / not interested / unclear) via Haiku
 *   - Record the reply text on the outreach row
 *
 * Security: requires RESEND_INBOUND_SECRET header match to prevent spoofing.
 *
 * Setup: in Resend, create an inbound parsing rule on a subdomain (eg
 * replies.nexoflow.tech) pointing here with the secret in a custom header.
 */

import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/server/db";
import { leads, leadOutreach, followUpSequences } from "@/server/db/schema";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  const secret = process.env.RESEND_INBOUND_SECRET;
  if (secret) {
    const provided = req.headers.get("x-inbound-secret") ?? req.headers.get("authorization")?.replace(/^Bearer\s+/, "");
    if (provided !== secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const from = extractEmail(body.from as string | { email?: string } | undefined);
  const subject = (body.subject as string | undefined) ?? "";
  const text = ((body.text as string | undefined) ?? (body.html as string | undefined) ?? "").slice(0, 8000);
  const inReplyTo = (body.in_reply_to as string | undefined) ?? (body.references as string | undefined);

  if (!from) {
    return NextResponse.json({ ok: true, ignored: true, reason: "no from address" });
  }

  // Match lead by sender email
  const lead = await db.query.leads.findFirst({ where: eq(leads.email, from.toLowerCase()) });
  if (!lead) {
    return NextResponse.json({ ok: true, ignored: true, reason: "no matching lead" });
  }

  // Find the most recent outreach to this lead (or match by inReplyTo if present)
  let outreach;
  if (inReplyTo) {
    outreach = await db.query.leadOutreach.findFirst({
      where: and(eq(leadOutreach.leadId, lead.id), eq(leadOutreach.providerMessageId, inReplyTo)),
    });
  }
  if (!outreach) {
    outreach = await db.query.leadOutreach.findFirst({
      where: eq(leadOutreach.leadId, lead.id),
      orderBy: [desc(leadOutreach.createdAt)],
    });
  }

  // Classify intent with Haiku (fast, cheap)
  type Intent = "interested" | "not_interested" | "unclear" | "question";
  let intent: Intent = "unclear";
  let summary = "";
  try {
    const prompt = `Classify this email reply intent. Return ONLY JSON.

Subject: ${subject}
Body: ${text.slice(0, 2000)}

Return: { "intent": "interested" | "not_interested" | "unclear" | "question", "summary": "one short sentence" }`;
    const resp = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 200,
      messages: [{ role: "user", content: prompt }],
    });
    const respText = resp.content[0]?.type === "text" ? resp.content[0].text.trim() : "{}";
    const m = respText.match(/\{[\s\S]*\}/);
    if (m) {
      const parsed = JSON.parse(m[0]) as { intent: Intent; summary: string };
      intent = parsed.intent;
      summary = parsed.summary;
    }
  } catch {
    // Classification is best-effort
  }

  // Update outreach row
  if (outreach) {
    await db
      .update(leadOutreach)
      .set({
        repliedAt: new Date(),
        providerStatus: `replied:${intent}`,
        message: outreach.message + `\n\n--- REPLY (${intent}) ---\n${summary ? `[${summary}]\n` : ""}${text.slice(0, 4000)}`,
      })
      .where(eq(leadOutreach.id, outreach.id));
  }

  // Advance lead status + pause sequences
  const newStatus = intent === "not_interested" ? "lost" : "replied";
  await db
    .update(leads)
    .set({ status: newStatus, updatedAt: new Date() })
    .where(eq(leads.id, lead.id));

  await db
    .update(followUpSequences)
    .set({ status: "paused", updatedAt: new Date() })
    .where(and(eq(followUpSequences.leadId, lead.id), eq(followUpSequences.status, "active")));

  return NextResponse.json({ ok: true, leadId: lead.id, intent });
}

function extractEmail(raw: unknown): string | null {
  if (!raw) return null;
  if (typeof raw === "string") {
    const m = raw.match(/<([^>]+)>/) ?? raw.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i);
    return m ? (m[1] ?? m[0]).toLowerCase() : null;
  }
  if (typeof raw === "object" && raw !== null && "email" in raw) {
    return (raw as { email?: string }).email?.toLowerCase() ?? null;
  }
  return null;
}
