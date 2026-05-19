import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/server/db";
import { decisionLog } from "@/server/db/schema";
import { eq } from "drizzle-orm";

// ─── Zod Schema ───────────────────────────────────────────────────────────────

const declSchema = z.object({
  declNumber: z.string().min(1).regex(/^DECL-\d{3,}$/, "Must match DECL-XXX format"),
  title: z.string().min(1, "Title is required"),
  status: z.enum(["proposed", "accepted", "deprecated", "superseded"]).default("proposed"),
  affectedStandards: z.array(z.string()).optional().default([]),
  affectedMocs: z.array(z.string()).optional().default([]),
  context: z.string().optional(),
  decision: z.string().min(1, "Decision is required"),
  consequences: z.string().optional(),
  date: z.string().optional(),
});

// ─── POST: Create or update a decision log entry from the vault ───────────────

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Accept single object or array
  const entries = Array.isArray(body) ? body : [body];

  const results: { declNumber: string; success: boolean; action: "created" | "updated" | "skipped"; error?: string }[] = [];

  for (const entry of entries) {
    const parsed = declSchema.safeParse(entry);
    if (!parsed.success) {
      const errors = parsed.error.flatten().fieldErrors;
      results.push({
        declNumber: (entry as Record<string, unknown>)?.declNumber as string ?? "unknown",
        success: false,
        action: "skipped",
        error: Object.values(errors).flat().join(", "),
      });
      continue;
    }

    const input = parsed.data;

    try {
      // Check if this DECL already exists
      const existing = await db
        .select({ id: decisionLog.id })
        .from(decisionLog)
        .where(eq(decisionLog.declNumber, input.declNumber))
        .limit(1);

      if (existing.length > 0) {
        // Update existing
        await db
          .update(decisionLog)
          .set({
            title: input.title,
            status: input.status,
            affectedStandards: input.affectedStandards,
            affectedMocs: input.affectedMocs,
            context: input.context || null,
            decision: input.decision,
            consequences: input.consequences || null,
            date: input.date ? new Date(input.date) : undefined,
          })
          .where(eq(decisionLog.id, existing[0]!.id));

        results.push({ declNumber: input.declNumber, success: true, action: "updated" });
      } else {
        // Create new
        await db
          .insert(decisionLog)
          .values({
            declNumber: input.declNumber,
            title: input.title,
            status: input.status,
            affectedStandards: input.affectedStandards,
            affectedMocs: input.affectedMocs,
            context: input.context || null,
            decision: input.decision,
            consequences: input.consequences || null,
            date: input.date ? new Date(input.date) : new Date(),
          });

        results.push({ declNumber: input.declNumber, success: true, action: "created" });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      results.push({
        declNumber: input.declNumber,
        success: false,
        action: "skipped",
        error: message,
      });
    }
  }

  const successCount = results.filter((r) => r.success).length;
  return NextResponse.json({
    success: successCount > 0,
    processed: results.length,
    succeeded: successCount,
    failed: results.length - successCount,
    results,
  });
}

// ─── GET: List decision log entries ───────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50"), 100);
  const offset = parseInt(searchParams.get("offset") ?? "0");

  const { desc, sql } = await import("drizzle-orm");

  const conditions = [];
  if (status) {
    conditions.push(eq(decisionLog.status, status as any));
  }

  const where = conditions.length > 0
    ? sql`${conditions[0]}`
    : undefined;

  const [rows, countResult] = await Promise.all([
    db
      .select()
      .from(decisionLog)
      .where(where)
      .orderBy(desc(decisionLog.date))
      .limit(limit)
      .offset(offset),
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(decisionLog)
      .where(where),
  ]);

  return NextResponse.json({
    decisions: rows,
    total: countResult[0]?.total ?? 0,
    limit,
    offset,
  });
}
