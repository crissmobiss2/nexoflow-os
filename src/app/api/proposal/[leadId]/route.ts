/**
 * GET /api/proposal/[leadId]
 *
 * Serves the AI-generated proposal HTML for a lead.
 * Public route — the leadId acts as a capability URL.
 */

import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { leads } from "@/server/db/schema";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ leadId: string }> },
) {
  const { leadId } = await params;

  const [lead] = await db
    .select({ proposalHtml: leads.proposalHtml, company: leads.company })
    .from(leads)
    .where(eq(leads.id, leadId))
    .limit(1);

  if (!lead) {
    return new NextResponse("Proposal not found", { status: 404 });
  }

  if (!lead.proposalHtml) {
    return new NextResponse(
      `<!DOCTYPE html><html><head><title>Proposal Not Generated</title><style>body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#0a0a0f;color:#888}</style></head><body><p>Proposal has not been generated yet.</p></body></html>`,
      { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } },
    );
  }

  return new NextResponse(lead.proposalHtml, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}
