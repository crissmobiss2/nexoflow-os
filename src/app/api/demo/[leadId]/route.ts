import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { leads } from "@/server/db/schema";
import { eq } from "drizzle-orm";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ leadId: string }> },
) {
  const { leadId } = await params;

  const [lead] = await db
    .select({ demoHtml: leads.demoHtml, company: leads.company })
    .from(leads)
    .where(eq(leads.id, leadId))
    .limit(1);

  if (!lead) {
    return new NextResponse("Demo not found", { status: 404 });
  }

  if (!lead.demoHtml) {
    return new NextResponse(
      `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Demo Not Ready</title>
<style>body{background:#0a0a0f;color:#fff;font-family:system-ui;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;text-align:center;}h1{font-size:1.5rem;margin-bottom:.5rem;}p{color:#888;font-size:.9rem;}</style>
</head><body><div><h1>Demo Not Generated Yet</h1><p>The demo for this lead hasn't been generated. Open the lead in NexoFlow and click "Generate Demo".</p></div></body></html>`,
      { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } },
    );
  }

  return new NextResponse(lead.demoHtml, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}
