/**
 * POST /api/webhooks/leads/[apiKey]
 *
 * External webhook endpoint for creating leads. Validates the API key,
 * then inserts a new lead from the JSON body.
 *
 * Body fields (all optional except at least one contact field):
 *   firstName, lastName, email, phone, company, website, industry,
 *   companySize, region, jobTitle, techStack, painPoints, scrapedData,
 *   notes, tags, source
 */

import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { apiKeys, leads } from "@/server/db/schema";

function hashKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ apiKey: string }> },
) {
  const { apiKey: rawKey } = await params;

  // Also accept key from Authorization header (Bearer token) — param takes precedence
  const authHeader = req.headers.get("authorization");
  const key = rawKey !== "_" ? rawKey : (authHeader?.replace(/^Bearer\s+/, "") ?? "");

  if (!key || !key.startsWith("nf_")) {
    return NextResponse.json({ error: "Invalid API key format" }, { status: 401 });
  }

  const prefix = key.slice(0, 8);
  const [storedKey] = await db
    .select({ id: apiKeys.id, keyHash: apiKeys.keyHash, isActive: apiKeys.isActive, permissions: apiKeys.permissions })
    .from(apiKeys)
    .where(eq(apiKeys.keyPrefix, prefix))
    .limit(1);

  if (!storedKey?.isActive || hashKey(key) !== storedKey.keyHash) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Update lastUsedAt (best-effort)
  void db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, storedKey.id));

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const allowedSources = ["csv_import", "manual", "api", "web_scraper"] as const;
  const source = allowedSources.includes(body.source as any) ? (body.source as typeof allowedSources[number]) : "api";

  // Map the contact form's "whatWeBuild" field to painPoints
  const painPoints = (body.painPoints ?? body.projectDescription ?? body.message) as string | undefined;
  const sourceDetail = (body.sourceDetail ?? body.formName ?? "api") as string;

  const [lead] = await db
    .insert(leads)
    .values({
      firstName: (body.firstName as string) || (body.name as string)?.split(" ")[0] || null,
      lastName: (body.lastName as string) || (body.name as string)?.split(" ").slice(1).join(" ") || null,
      email: (body.email as string) || null,
      phone: (body.phone as string) || null,
      company: (body.company as string) || null,
      website: (body.website as string) || null,
      industry: (body.industry as string) || null,
      companySize: (body.companySize as string) || null,
      region: (body.region as string) || null,
      jobTitle: (body.jobTitle as string) || null,
      techStack: (body.techStack as string) || null,
      painPoints: painPoints || null,
      scrapedData: (body.scrapedData as string) || null,
      notes: (body.notes as string) || null,
      tags: Array.isArray(body.tags) ? (body.tags as string[]) : null,
      source,
      sourceDetail,
      affiliateCode: (body.affiliateCode as string) || null,
      teamId: null,
    })
    .returning({ id: leads.id, status: leads.status, createdAt: leads.createdAt });

  return NextResponse.json({ id: lead?.id, status: lead?.status, createdAt: lead?.createdAt }, { status: 201 });
}
