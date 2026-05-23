/**
 * GET /api/cron/follow-ups
 *
 * Runs every hour (Vercel Cron). Finds active follow-up sequences whose
 * nextSendAt is due, generates the next email with Claude, sends via Resend,
 * advances the sequence step, and schedules the next send.
 *
 * Cadence (days from sequence start): 1, 3, 7, 14, 21
 *
 * Auth: requires CRON_SECRET in Authorization header (Vercel sets this
 * automatically when the route is invoked from a cron). Manual invocations
 * must pass `Authorization: Bearer <CRON_SECRET>`.
 */

import { NextRequest, NextResponse } from "next/server";
import { and, eq, lte, sql } from "drizzle-orm";
import Anthropic from "@anthropic-ai/sdk";
import { Resend } from "resend";
import { db } from "@/server/db";
import { followUpSequences, leads, leadOutreach } from "@/server/db/schema";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const resend = new Resend(process.env.RESEND_API_KEY ?? process.env.AUTH_RESEND_KEY ?? "not_configured");

const STEP_CADENCE_DAYS = [1, 3, 7, 14, 21, 35, 60]; // gap from previous send

export async function GET(req: NextRequest) {
  // Auth check
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const now = new Date();

  // Find due active sequences
  const due = await db
    .select()
    .from(followUpSequences)
    .where(and(
      eq(followUpSequences.status, "active"),
      lte(followUpSequences.nextSendAt, now),
    ))
    .limit(20); // process at most 20 per tick

  const results: { sequenceId: string; status: string; error?: string }[] = [];

  for (const seq of due) {
    try {
      // Bail if we've hit the total
      if (seq.currentStep >= seq.totalSteps) {
        await db
          .update(followUpSequences)
          .set({ status: "completed", completedAt: now, updatedAt: now })
          .where(eq(followUpSequences.id, seq.id));
        results.push({ sequenceId: seq.id, status: "completed" });
        continue;
      }

      const lead = await db.query.leads.findFirst({ where: eq(leads.id, seq.leadId) });
      if (!lead) {
        await db
          .update(followUpSequences)
          .set({ status: "cancelled", updatedAt: now })
          .where(eq(followUpSequences.id, seq.id));
        results.push({ sequenceId: seq.id, status: "lead_missing" });
        continue;
      }

      // If lead already replied/won/lost, stop the sequence
      if (["replied", "won", "lost", "archived"].includes(lead.status)) {
        await db
          .update(followUpSequences)
          .set({ status: "completed", completedAt: now, updatedAt: now })
          .where(eq(followUpSequences.id, seq.id));
        results.push({ sequenceId: seq.id, status: `stopped:${lead.status}` });
        continue;
      }

      if (!lead.email) {
        await db
          .update(followUpSequences)
          .set({ status: "cancelled", updatedAt: now })
          .where(eq(followUpSequences.id, seq.id));
        results.push({ sequenceId: seq.id, status: "no_email" });
        continue;
      }

      // Generate the next email
      const stepNum = seq.currentStep + 1;
      const totalSteps = seq.totalSteps;
      const { subject, html, plain } = await generateFollowUp(lead, stepNum, totalSteps);

      // Send via Resend
      let providerMessageId: string | null = null;
      let providerError: string | null = null;
      try {
        const sendResult = await resend.emails.send({
          from: "NexoFlow <hello@nexoflow.tech>",
          to: [lead.email],
          subject,
          html,
        });
        const data = (sendResult as { data?: { id?: string } | null }).data;
        const error = (sendResult as { error?: { message?: string } | null }).error;
        if (data?.id) providerMessageId = data.id;
        if (error) providerError = error.message ?? "send failed";
      } catch (err) {
        providerError = err instanceof Error ? err.message : "unknown";
      }

      // Record outreach row
      await db.insert(leadOutreach).values({
        leadId: lead.id,
        channel: "email",
        subject,
        message: plain,
        providerMessageId,
        providerStatus: providerMessageId ? "sent" : "failed",
        providerError,
      });

      // Advance the sequence
      const cadenceIdx = Math.min(stepNum, STEP_CADENCE_DAYS.length - 1);
      const nextGapDays = STEP_CADENCE_DAYS[cadenceIdx]!;
      const nextSendAt = new Date(now);
      nextSendAt.setDate(nextSendAt.getDate() + nextGapDays);

      const isComplete = stepNum >= totalSteps;
      await db
        .update(followUpSequences)
        .set({
          currentStep: stepNum,
          status: isComplete ? "completed" : "active",
          nextSendAt: isComplete ? null : nextSendAt,
          completedAt: isComplete ? now : null,
          updatedAt: now,
        })
        .where(eq(followUpSequences.id, seq.id));

      results.push({
        sequenceId: seq.id,
        status: providerMessageId ? `sent step ${stepNum}/${totalSteps}` : `failed step ${stepNum}: ${providerError}`,
      });
    } catch (err) {
      results.push({ sequenceId: seq.id, status: "error", error: err instanceof Error ? err.message : "unknown" });
    }
  }

  return NextResponse.json({
    ok: true,
    processed: due.length,
    results,
    ranAt: now.toISOString(),
  });
}

async function generateFollowUp(
  lead: typeof leads.$inferSelect,
  step: number,
  totalSteps: number,
): Promise<{ subject: string; html: string; plain: string }> {
  const name = [lead.firstName, lead.lastName].filter(Boolean).join(" ") || "there";
  const baseUrl = process.env.NEXTAUTH_URL ?? "https://nexoflow.tech";
  const demoUrl = lead.demoUrl ? `${baseUrl}${lead.demoUrl}` : null;

  const profile = lead.businessProfile;
  const profileLine = profile?.buildOpportunities?.[0]?.title
    ? `(specifically: ${profile.buildOpportunities[0]!.title})`
    : "";

  const tonePerStep: Record<number, string> = {
    1: "soft check-in, no pressure, restate the value",
    2: "share a relevant insight or quick wins from a similar customer",
    3: "be direct — ask if it's worth a 15-min call, give them an easy out",
    4: "value-add (eg specific stat or quick win), no ask",
    5: "the breakup email — short, polite, 'closing the loop, last touch'",
  };
  const tone = tonePerStep[step] ?? "polite check-in";

  const prompt = `Write a follow-up email (step ${step} of ${totalSteps}) from NexoFlow to ${name} at ${lead.company ?? "their company"}.

Tone for this step: ${tone}
What we're offering: ${profile?.offer ? `to help with their ${profile.offer}` : "custom software they need"} ${profileLine}
${demoUrl ? `Demo we sent: ${demoUrl}` : ""}

Output ONLY this format (no extra text):
SUBJECT: <subject line, under 60 chars>
BODY:
<email body, plain text, 3-6 short sentences max, no signature — we'll append it>`;

  const resp = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 500,
    messages: [{ role: "user", content: prompt }],
  });
  const text = resp.content[0]?.type === "text" ? resp.content[0].text : "";

  let subject = `Quick follow-up`;
  let body = text;
  const subjMatch = text.match(/SUBJECT:\s*(.+)/i);
  const bodyMatch = text.match(/BODY:\s*([\s\S]+)/i);
  if (subjMatch) subject = subjMatch[1]!.trim();
  if (bodyMatch) body = bodyMatch[1]!.trim();

  const demoSection = demoUrl
    ? `<p style="margin-top:24px"><a href="${demoUrl}" style="display:inline-block;padding:12px 24px;background:linear-gradient(135deg,#7c5cbf,#4f8ef7);color:#fff;border-radius:8px;text-decoration:none;font-weight:600;">View Your Demo →</a></p>`
    : "";

  const html = `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:40px 20px;color:#1a1a2e;background:#fff;">
    <div style="font-size:15px;line-height:1.7;color:#2d2d44">${body.replace(/\n/g, "<br>")}</div>
    ${demoSection}
    <p style="margin-top:32px;font-size:14px;color:#2d2d44">
      Chris<br>
      <a href="${baseUrl}" style="color:#7c5cbf;text-decoration:none">NexoFlow</a>
    </p>
    <p style="margin-top:24px;font-size:11px;color:#999;border-top:1px solid #eee;padding-top:16px">
      Not interested? Just reply STOP and I'll close the loop.
    </p>
  </div>`;

  return { subject, html, plain: body };
}
