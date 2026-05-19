import { eq, desc } from "drizzle-orm";
import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "../trpc";
import { projectTemplates, projectTemplateItems } from "../db/schema";

export const templatesRouter = createTRPCRouter({
  list: publicProcedure.query(async ({ ctx }) => {
    return ctx.db.query.projectTemplates.findMany({
      orderBy: [desc(projectTemplates.createdAt)],
      with: { phases: { orderBy: (items, { asc }) => [asc(items.phaseOrder)] }, creator: true },
    });
  }),

  get: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.query.projectTemplates.findFirst({
        where: eq(projectTemplates.id, input.id),
        with: { phases: { orderBy: (items, { asc }) => [asc(items.phaseOrder)] }, creator: true },
      });
    }),

  create: publicProcedure
    .input(
      z.object({
        name: z.string().min(1),
        description: z.string().optional(),
        projectType: z.enum([
          "website", "web_app", "mobile_app", "desktop_app",
          "saas", "marketplace", "internal_tool", "ai_product", "ecommerce", "portal",
        ]),
        defaultBriefTemplate: z.string().optional(),
        phases: z.array(
          z.object({
            phaseName: z.string().min(1),
            phaseOrder: z.number().int().min(0),
            description: z.string().optional(),
          }),
        ).default([]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { phases, ...templateData } = input;

      const [template] = await ctx.db
        .insert(projectTemplates)
        .values(templateData)
        .returning();

      if (!template) throw new Error("Failed to create template");

      if (phases.length > 0) {
        await ctx.db.insert(projectTemplateItems).values(
          phases.map((p) => ({
            templateId: template.id,
            phaseName: p.phaseName,
            phaseOrder: p.phaseOrder,
            description: p.description,
          })),
        );
      }

      return ctx.db.query.projectTemplates.findFirst({
        where: eq(projectTemplates.id, template.id),
        with: { phases: { orderBy: (items, { asc }) => [asc(items.phaseOrder)] } },
      });
    }),

  update: publicProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().optional(),
        description: z.string().optional(),
        projectType: z
          .enum([
            "website", "web_app", "mobile_app", "desktop_app",
            "saas", "marketplace", "internal_tool", "ai_product", "ecommerce", "portal",
          ])
          .optional(),
        defaultBriefTemplate: z.string().optional(),
        phases: z
          .array(
            z.object({
              id: z.string().uuid().optional(),
              phaseName: z.string().min(1),
              phaseOrder: z.number().int().min(0),
              description: z.string().optional(),
            }),
          )
          .optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, phases, ...data } = input;

      if (Object.keys(data).length > 0) {
        await ctx.db
          .update(projectTemplates)
          .set({ ...data, updatedAt: new Date() })
          .where(eq(projectTemplates.id, id));
      }

      if (phases) {
        // Delete existing items and re-insert
        await ctx.db.delete(projectTemplateItems).where(eq(projectTemplateItems.templateId, id));
        await ctx.db.insert(projectTemplateItems).values(
          phases.map((p) => ({
            templateId: id,
            phaseName: p.phaseName,
            phaseOrder: p.phaseOrder,
            description: p.description,
          })),
        );
      }

      return ctx.db.query.projectTemplates.findFirst({
        where: eq(projectTemplates.id, id),
        with: { phases: { orderBy: (items, { asc }) => [asc(items.phaseOrder)] } },
      });
    }),

  delete: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.delete(projectTemplates).where(eq(projectTemplates.id, input.id));
    }),
});
