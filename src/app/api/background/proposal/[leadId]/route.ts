/**
 * POST /api/background/proposal/[leadId]
 *
 * Background proposal-generation worker. Called fire-and-forget from the tRPC
 * generateProposal mutation. Same pattern as the demo background route.
 */

import { NextRequest, NextResponse } from "next/server";
import { runProposalGeneration } from "@/server/routers/leads";

export const maxDuration = 300;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ leadId: string }> },
) {
  // Minimal auth
  const secret = req.headers.get("x-internal-secret");
  const expectedSecret = process.env.CRON_SECRET ?? process.env.ADMIN_REGEN_SECRET;
  if (expectedSecret && secret !== expectedSecret) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { leadId } = await params;

  try {
    await runProposalGeneration(leadId);
    return new NextResponse("OK", { status: 200 });
  } catch (err) {
    console.error("[background/proposal] Error for lead", leadId, ":", err instanceof Error ? err.message : err);
    return new NextResponse("Internal error", { status: 500 });
  }
}
