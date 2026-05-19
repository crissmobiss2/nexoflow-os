import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/server/db";
import { clients, projects, projectBriefs } from "@/server/db/schema";
import crypto from "crypto";

// ─── Zod Schema for intake validation ─────────────────────────────────────────

const intakeSchema = z.object({
  // Client fields
  name: z.string().min(1, "Client name is required"),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  company: z.string().optional(),
  website: z.string().optional(),
  industry: z.string().optional(),
  companySize: z.string().optional(),
  region: z.string().optional(),
  businessDescription: z.string().optional(),
  targetCustomers: z.string().optional(),
  currentChallenges: z.string().optional(),
  existingTech: z.string().optional(),
  typicalBudget: z.string().optional(),
  urgency: z.string().optional(),
  decisionMakerRole: z.string().optional(),
  notes: z.string().optional(),

  // Project fields
  projectName: z.string().min(1, "Project name is required"),
  projectType: z.enum([
    "website", "web_app", "mobile_app", "desktop_app",
    "saas", "marketplace", "internal_tool", "ai_product", "ecommerce", "portal",
  ]),

  // Brief fields
  targetUser: z.string().optional(),
  coreJobToBeDone: z.string().optional(),
  keyIntegrations: z.string().optional(),
  constraints: z.string().optional(),
  additionalContext: z.string().optional(),
});

// ─── Portal token generator ───────────────────────────────────────────────────

function generatePortalTokenFn(): string {
  return crypto.randomBytes(24).toString("hex");
}

// ─── POST Handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Validate with Zod
  const parsed = intakeSchema.safeParse(body);
  if (!parsed.success) {
    const errors = parsed.error.flatten().fieldErrors;
    return NextResponse.json(
      { error: "Validation failed", details: errors },
      { status: 422 },
    );
  }

  const input = parsed.data;

  try {
    // 1. Create client record
    const [client] = await db
      .insert(clients)
      .values({
        name: input.name,
        email: input.email || null,
        phone: input.phone || null,
        company: input.company || null,
        website: input.website || null,
        industry: input.industry || null,
        companySize: input.companySize || null,
        region: input.region || null,
        businessDescription: input.businessDescription || null,
        targetCustomers: input.targetCustomers || null,
        currentChallenges: input.currentChallenges || null,
        existingTech: input.existingTech || null,
        typicalBudget: input.typicalBudget || null,
        urgency: input.urgency || null,
        decisionMakerRole: input.decisionMakerRole || null,
        notes: input.notes || null,
        onboardedAt: new Date(),
      })
      .returning();

    if (!client) {
      return NextResponse.json({ error: "Failed to create client" }, { status: 500 });
    }

    // 2. Create project record with portal token
    const portalToken = generatePortalTokenFn();
    const [project] = await db
      .insert(projects)
      .values({
        name: input.projectName,
        clientId: client.id,
        projectType: input.projectType,
        status: "brief",
        portalToken,
        portalEnabled: true,
      })
      .returning();

    if (!project) {
      return NextResponse.json({ error: "Failed to create project" }, { status: 500 });
    }

    // 3. Create project brief
    const [brief] = await db
      .insert(projectBriefs)
      .values({
        projectId: project.id,
        targetUser: input.targetUser || null,
        coreJobToBeDone: input.coreJobToBeDone || null,
        keyIntegrations: input.keyIntegrations || null,
        constraints: input.constraints || null,
        additionalContext: input.additionalContext || null,
      })
      .returning();

    // 4. Return created IDs and portal URL
    const portalUrl = `https://nexoflow-os.vercel.app/portal/${portalToken}`;

    return NextResponse.json({
      success: true,
      clientId: client.id,
      projectId: project.id,
      briefId: brief?.id ?? null,
      portalUrl,
      portalToken,
    }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[intake] Error creating client intake:", err);
    return NextResponse.json({ error: "Internal server error", details: message }, { status: 500 });
  }
}
