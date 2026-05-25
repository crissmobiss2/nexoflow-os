/**
 * POST /api/background/proposal/[leadId]
 *
 * Background proposal-generation worker. Same pattern as the demo background route:
 * 1. tRPC generateProposal mutation awaits fetch to this route (10s timeout)
 * 2. This route validates, registers after() callback, returns 202 immediately (<100ms)
 * 3. tRPC mutation gets 202 and returns { status: 'started' } to client
 * 4. after() runs runProposalGeneration() post-response (up to maxDuration: 300s)
 *
 * Protected by x-internal-secret header (CRON_SECRET or ADMIN_REGEN_SECRET).
 */

import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { runProposalGeneration } from "@/server/routers/leads";

export const maxDuration = 300;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ leadId: string }> },
) {
  // Minimal auth — prevent arbitrary Anthropic spend from external callers
  const secret = req.headers.get("x-internal-secret");
  const expectedSecret = process.env.CRON_SECRET ?? process.env.ADMIN_REGEN_SECRET;
  if (expectedSecret && secret !== expectedSecret) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { leadId } = await params;

  // Schedule the heavy Anthropic work to run AFTER the 202 response is sent.
  // after() works here because this is a proper Next.js Route Handler with
  // the full ALS context — unlike when called from inside tRPC's adapter.
  after(async () => {
    try {
      await runProposalGeneration(leadId);
    } catch (err) {
      console.error("[background/proposal] Error for lead", leadId, ":", err instanceof Error ? err.message : err);
    }
  });

  // Return immediately — generation runs in background
  return new NextResponse("Accepted", { status: 202 });
}
