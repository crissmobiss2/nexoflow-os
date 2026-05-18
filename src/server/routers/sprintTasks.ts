import { eq, and, desc, asc, sql } from "drizzle-orm";
import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "../trpc";
import { sprintTasks, projects, projectArtifacts } from "../db/schema";
import { generateSprintTasks } from "@/lib/ai/generate";

export const sprintTasksRouter = createTRPCRouter({
  list: publicProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.query.sprintTasks.findMany({
        where: eq(sprintTasks.projectId, input.projectId),
        orderBy: [asc(sprintTasks.order), asc(sprintTasks.createdAt)],
        with: { assignee: true },
      });
    }),

  create: publicProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        phaseId: z.string().uuid().optional(),
        title: z.string().min(1).max(500),
        description: z.string().optional(),
        storyPoints: z.number().int().min(1).max(13).optional().default(1),
        priority: z.number().int().min(0).max(3).optional().default(0),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [task] = await ctx.db
        .insert(sprintTasks)
        .values({
          projectId: input.projectId,
          phaseId: input.phaseId,
          title: input.title,
          description: input.description,
          storyPoints: input.storyPoints,
          priority: input.priority,
        })
        .returning();
      return task;
    }),

  update: publicProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        title: z.string().min(1).max(500).optional(),
        description: z.string().optional(),
        storyPoints: z.number().int().min(1).max(13).optional(),
        status: z.enum(["backlog", "todo", "in_progress", "review", "done", "cancelled"]).optional(),
        priority: z.number().int().min(0).max(3).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [task] = await ctx.db
        .update(sprintTasks)
        .set({ ...input, updatedAt: new Date() })
        .where(eq(sprintTasks.id, input.id))
        .returning();
      return task;
    }),

  delete: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.delete(sprintTasks).where(eq(sprintTasks.id, input.id));
      return { success: true };
    }),

  reorder: publicProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        taskId: z.string().uuid(),
        newStatus: z.enum(["backlog", "todo", "in_progress", "review", "done", "cancelled"]),
        newOrder: z.number().int().min(0),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [task] = await ctx.db
        .update(sprintTasks)
        .set({
          status: input.newStatus,
          order: input.newOrder,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(sprintTasks.id, input.taskId),
            eq(sprintTasks.projectId, input.projectId),
          ),
        )
        .returning();
      return task;
    }),

  generateFromScope: publicProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const project = await ctx.db.query.projects.findFirst({
        where: eq(projects.id, input.projectId),
        with: { artifacts: true },
      });
      if (!project) throw new Error("Project not found");

      const scopeArtifact = project.artifacts.find(
        (a) => a.artifactType === "scope_doc",
      );
      if (!scopeArtifact) throw new Error("No scope document found. Generate a scope document first.");

      const tasks = await generateSprintTasks(project.name, scopeArtifact.content);

      const inserted = [];
      for (let i = 0; i < tasks.length; i++) {
        const task = tasks[i];
        if (!task) continue;
        const [t] = await ctx.db
          .insert(sprintTasks)
          .values({
            projectId: input.projectId,
            title: task.title,
            description: task.description,
            storyPoints: task.storyPoints,
            priority: task.priority,
            order: i,
          })
          .returning();
        inserted.push(t);
      }

      return { tasks: inserted, count: inserted.length };
    }),
});
