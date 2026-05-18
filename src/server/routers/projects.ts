import { eq, desc } from "drizzle-orm";
import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "../trpc";
import {
  projects,
  projectBriefs,
  opportunityScores,
  projectArtifacts,
  projectPhases,
} from "../db/schema";
import { scoreOpportunity, generateScope, generateArchitecture } from "@/lib/ai/generate";

const DEFAULT_PHASES = [
  { name: "Discovery", order: 0 },
  { name: "Architecture", order: 1 },
  { name: "Core Build", order: 2 },
  { name: "Polish & QA", order: 3 },
  { name: "Launch & Handoff", order: 4 },
];

export const projectsRouter = createTRPCRouter({
  list: publicProcedure.query(async ({ ctx }) => {
    return ctx.db.query.projects.findMany({
      orderBy: [desc(projects.createdAt)],
      with: { client: true, score: true },
    });
  }),

  get: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.query.projects.findFirst({
        where: eq(projects.id, input.id),
        with: { client: true, brief: true, score: true, artifacts: true, phases: true },
      });
    }),

  create: publicProcedure
    .input(
      z.object({
        name: z.string().min(1),
        projectType: z.enum([
          "website", "web_app", "mobile_app", "desktop_app",
          "saas", "marketplace", "internal_tool", "ai_product", "ecommerce", "portal",
        ]),
        industry: z.string().optional(),
        budgetRange: z.string().optional(),
        timelineWeeks: z.number().int().positive().optional(),
        clientId: z.string().uuid().optional(),
        brief: z.object({
          targetUser: z.string().optional(),
          coreJobToBeDone: z.string().optional(),
          existingTech: z.string().optional(),
          keyIntegrations: z.string().optional(),
          constraints: z.string().optional(),
          additionalContext: z.string().optional(),
        }),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [project] = await ctx.db
        .insert(projects)
        .values({
          name: input.name,
          projectType: input.projectType,
          industry: input.industry,
          budgetRange: input.budgetRange,
          timelineWeeks: input.timelineWeeks,
          clientId: input.clientId,
          status: "brief",
        })
        .returning();

      if (!project) throw new Error("Failed to create project");

      await ctx.db.insert(projectBriefs).values({
        projectId: project.id,
        ...input.brief,
      });

      await ctx.db.insert(projectPhases).values(
        DEFAULT_PHASES.map((p) => ({
          projectId: project.id,
          phaseName: p.name,
          phaseOrder: p.order,
        })),
      );

      return project;
    }),

  score: publicProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const project = await ctx.db.query.projects.findFirst({
        where: eq(projects.id, input.projectId),
        with: { brief: true },
      });
      if (!project) throw new Error("Project not found");

      const briefText = [
        `Project: ${project.name}`,
        `Type: ${project.projectType}`,
        `Industry: ${project.industry ?? "not specified"}`,
        `Budget: ${project.budgetRange ?? "not specified"}`,
        `Timeline: ${project.timelineWeeks ? `${project.timelineWeeks} weeks` : "not specified"}`,
        `Target User: ${project.brief?.targetUser ?? "not specified"}`,
        `Core Job: ${project.brief?.coreJobToBeDone ?? "not specified"}`,
        `Existing Tech: ${project.brief?.existingTech ?? "none"}`,
        `Integrations: ${project.brief?.keyIntegrations ?? "none"}`,
        `Constraints: ${project.brief?.constraints ?? "none"}`,
        `Context: ${project.brief?.additionalContext ?? "none"}`,
      ].join("\n");

      const result = await scoreOpportunity(briefText);

      await ctx.db.insert(opportunityScores).values({
        projectId: input.projectId,
        ...result,
        aiRationale: result.rationale,
      });

      await ctx.db
        .update(projects)
        .set({
          opportunityScore: result.totalScore,
          scoreDecision: result.decision,
          status: "scored",
        })
        .where(eq(projects.id, input.projectId));

      return result;
    }),

  generateScope: publicProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const project = await ctx.db.query.projects.findFirst({
        where: eq(projects.id, input.projectId),
        with: { brief: true },
      });
      if (!project) throw new Error("Project not found");

      const briefText = [
        `Project Name: ${project.name}`,
        `Type: ${project.projectType}`,
        `Industry: ${project.industry ?? "general"}`,
        `Budget: ${project.budgetRange ?? "TBD"}`,
        `Timeline: ${project.timelineWeeks ? `${project.timelineWeeks} weeks` : "TBD"}`,
        `Target User: ${project.brief?.targetUser ?? "TBD"}`,
        `Core Job To Be Done: ${project.brief?.coreJobToBeDone ?? "TBD"}`,
        `Existing Tech: ${project.brief?.existingTech ?? "none"}`,
        `Required Integrations: ${project.brief?.keyIntegrations ?? "none"}`,
        `Constraints: ${project.brief?.constraints ?? "none"}`,
        `Additional Context: ${project.brief?.additionalContext ?? "none"}`,
      ].join("\n");

      const result = await generateScope(briefText);

      await ctx.db.insert(projectArtifacts).values({
        projectId: input.projectId,
        artifactType: "scope_doc",
        content: result.content,
        modelUsed: "claude-sonnet-4-6",
        promptTokens: result.promptTokens,
        completionTokens: result.completionTokens,
      });

      await ctx.db
        .update(projects)
        .set({ status: "scoped" })
        .where(eq(projects.id, input.projectId));

      return { content: result.content };
    }),

  generateArchitecture: publicProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const project = await ctx.db.query.projects.findFirst({
        where: eq(projects.id, input.projectId),
        with: { brief: true, artifacts: true },
      });
      if (!project) throw new Error("Project not found");

      const scopeArtifact = project.artifacts.find((a) => a.artifactType === "scope_doc");
      if (!scopeArtifact) throw new Error("Generate scope document first");

      const briefText = `${project.name} — ${project.projectType} for ${project.industry ?? "general"}`;
      const result = await generateArchitecture(briefText, scopeArtifact.content);

      await ctx.db.insert(projectArtifacts).values({
        projectId: input.projectId,
        artifactType: "architecture",
        content: result.content,
        modelUsed: "claude-sonnet-4-6",
        promptTokens: result.promptTokens,
        completionTokens: result.completionTokens,
      });

      await ctx.db
        .update(projects)
        .set({ status: "architected" })
        .where(eq(projects.id, input.projectId));

      return { content: result.content };
    }),

  getProposal: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const project = await ctx.db.query.projects.findFirst({
        where: eq(projects.id, input.id),
        with: { client: true, brief: true, artifacts: true, phases: true },
      });
      if (!project) throw new Error("Project not found");
      const scopeArtifact = project.artifacts.find((a) => a.artifactType === "scope_doc");
      return {
        ...project,
        scopeContent: scopeArtifact?.content ?? null,
      };
    }),

  getPortalProject: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.query.projects.findFirst({
        where: eq(projects.portalToken, input.token),
        with: { client: true, brief: true, artifacts: true, phases: true },
      });
    }),

  enablePortal: publicProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const token = crypto.randomUUID();
      await ctx.db
        .update(projects)
        .set({ portalToken: token, portalEnabled: true })
        .where(eq(projects.id, input.projectId));
      return { token };
    }),

  disablePortal: publicProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(projects)
        .set({ portalEnabled: false })
        .where(eq(projects.id, input.projectId));
      return { success: true };
    }),

  getArtifact: publicProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        artifactType: z.enum([
          "scope_doc", "tech_stack", "architecture", "risk_register",
          "code_bundle", "file_tree", "database_schema", "deployment_config",
        ]),
      }),
    )
    .query(async ({ ctx, input }) => {
      return ctx.db.query.projectArtifacts.findFirst({
        where: (a, { and, eq }) =>
          and(eq(a.projectId, input.projectId), eq(a.artifactType, input.artifactType)),
        orderBy: [desc(projectArtifacts.createdAt)],
      });
    }),
});
