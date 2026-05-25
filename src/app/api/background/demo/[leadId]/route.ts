/**
 * POST /api/background/demo/[leadId]
 *
 * Background demo-generation worker. Called fire-and-forget from the tRPC
 * generateDemo mutation. Runs in its own Vercel function invocation (up to
 * maxDuration: 300s) so the Anthropic call (~90–120s for 8192 tokens) can
 * complete without hitting the edge idle TCP timeout.
 *
 * Protected by x-internal-secret header (CRON_SECRET or ADMIN_REGEN_SECRET).
 */

import { NextRequest, NextResponse } from "next/server";
import { runDemoGeneration } from "@/server/routers/leads";

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

  let autoBuildProfile = true;
  try {
    const body = await req.json() as { autoBuildProfile?: boolean };
    if (typeof body.autoBuildProfile === "boolean") autoBuildProfile = body.autoBuildProfile;
  } catch {
    // ignore parse errors — use default
  }

  try {
    await runDemoGeneration(leadId, autoBuildProfile);
    return new NextResponse("OK", { status: 200 });
  } catch (err) {
    console.error("[background/demo] Error for lead", leadId, ":", err instanceof Error ? err.message : err);
    return new NextResponse("Internal error", { status: 500 });
  }
}
