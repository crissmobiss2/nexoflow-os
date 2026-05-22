import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { leads, invoices } from "@/server/db/schema";
import { count, gte, sql } from "drizzle-orm";
import Anthropic from "@anthropic-ai/sdk";
import { Resend } from "resend";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const resend = new Resend(process.env.RESEND_API_KEY ?? process.env.AUTH_RESEND_KEY ?? "not_configured");

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret");
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({})) as { email?: string };
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  const [newLeads, wonLeads, paidInvoicesRaw, totalLeadsRaw] = await Promise.all([
    db.select({ count: count() }).from(leads).where(gte(leads.createdAt, oneWeekAgo)),
    db.select({ count: count() }).from(leads).where(sql`${leads.status} = 'won' AND ${leads.updatedAt} >= ${oneWeekAgo}`),
    db.select({ total: sql<number>`sum(${invoices.total})`, count: count() }).from(invoices)
      .where(sql`${invoices.status} = 'paid' AND ${invoices.updatedAt} >= ${oneWeekAgo}`),
    db.select({ count: count() }).from(leads),
  ]);

  const newLeadsCount = newLeads[0]?.count ?? 0;
  const wonCount = wonLeads[0]?.count ?? 0;
  const invoicePaidAmount = Number(paidInvoicesRaw[0]?.total ?? 0);
  const invoicePaidCount = paidInvoicesRaw[0]?.count ?? 0;
  const totalLeads = totalLeadsRaw[0]?.count ?? 0;
  const conversionRate = totalLeads > 0 ? Math.round((wonCount / totalLeads) * 100) : 0;

  const resp = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001", max_tokens: 400,
    messages: [{ role: "user", content: `Generate a brief weekly business report for NexoFlow (software agency).

Stats this week:
- New leads: ${newLeadsCount}
- Deals won: ${wonCount}
- Invoices paid: ${invoicePaidCount} (£${(invoicePaidAmount / 100).toFixed(2)})
- Overall conversion rate: ${conversionRate}%

Write a professional but friendly 3-paragraph weekly summary with performance overview, key wins/concerns, and one strategic recommendation. Under 200 words.` }],
  });
  const reportText = resp.content[0]?.type === "text" ? resp.content[0].text : "Report unavailable.";

  const recipientEmail = body.email ?? process.env.REPORT_EMAIL ?? "crissmobiss@gmail.com";
  await resend.emails.send({
    from: "NexoFlow Reports <reports@nexoflow.tech>",
    to: [recipientEmail],
    subject: `NexoFlow Weekly Report — w/e ${new Date().toLocaleDateString("en-GB")}`,
    html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
<h2 style="color:#7c5cbf">NexoFlow Weekly Report</h2>
<p style="color:#666;font-size:13px">Week ending ${new Date().toLocaleDateString("en-GB")}</p>
<hr style="border-color:#eee">
<table style="width:100%;border-collapse:collapse;margin:16px 0">
<tr><td style="padding:8px;background:#f9f9f9"><strong>New Leads</strong></td><td style="padding:8px;text-align:right;font-weight:bold">${newLeadsCount}</td></tr>
<tr><td style="padding:8px"><strong>Deals Won</strong></td><td style="padding:8px;text-align:right;color:#22c55e;font-weight:bold">${wonCount}</td></tr>
<tr><td style="padding:8px;background:#f9f9f9"><strong>Revenue Collected</strong></td><td style="padding:8px;text-align:right;font-weight:bold">£${(invoicePaidAmount / 100).toFixed(2)}</td></tr>
<tr><td style="padding:8px"><strong>Conversion Rate</strong></td><td style="padding:8px;text-align:right;font-weight:bold">${conversionRate}%</td></tr>
</table>
<hr style="border-color:#eee">
<h3>AI Analysis</h3>
${reportText.split("\n").map((p) => p.trim() ? `<p style="color:#444;line-height:1.6">${p}</p>` : "").join("")}
<hr style="border-color:#eee">
<p style="color:#999;font-size:12px">NexoFlow OS · <a href="https://nexoflow-os-crissmobiss2s-projects.vercel.app">Open Dashboard</a></p>
</div>`,
  }).catch(() => null);

  return NextResponse.json({ ok: true, stats: { newLeadsCount, wonCount, invoicePaidAmount, conversionRate }, report: reportText });
}

export async function GET() {
  return NextResponse.json({ info: "POST to trigger the weekly AI report email." });
}
