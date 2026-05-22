import { eq, desc, asc } from "drizzle-orm";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "../trpc";
import { caseStudies, clients, projects } from "../db/schema";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const caseStudyInput = z.object({
  clientName: z.string().min(1),
  clientTitle: z.string().optional(),
  clientCompany: z.string().optional(),
  clientIndustry: z.string().optional(),
  avatarInitials: z.string().max(4).optional(),
  testimonial: z.string().min(1),
  metric1Label: z.string().optional(),
  metric1Value: z.string().optional(),
  metric2Label: z.string().optional(),
  metric2Value: z.string().optional(),
  metric3Label: z.string().optional(),
  metric3Value: z.string().optional(),
  linkedProjectId: z.string().uuid().optional().nullable(),
  linkedClientId: z.string().uuid().optional().nullable(),
});

export const caseStudiesRouter = createTRPCRouter({
  list: publicProcedure
    .input(z.object({ publishedOnly: z.boolean().optional() }).optional())
    .query(async ({ ctx, input }) => {
      return ctx.db
        .select()
        .from(caseStudies)
        .where(input?.publishedOnly ? eq(caseStudies.published, true) : undefined)
        .orderBy(asc(caseStudies.sortOrder), desc(caseStudies.createdAt));
    }),

  get: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.query.caseStudies.findFirst({
        where: eq(caseStudies.id, input.id),
        with: { project: true, client: true },
      });
    }),

  create: protectedProcedure
    .input(caseStudyInput)
    .mutation(async ({ ctx, input }) => {
      const initials = input.avatarInitials ??
        input.clientName.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
      const [cs] = await ctx.db
        .insert(caseStudies)
        .values({ ...input, avatarInitials: initials, published: false })
        .returning();
      return cs;
    }),

  update: protectedProcedure
    .input(caseStudyInput.partial().extend({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const [updated] = await ctx.db
        .update(caseStudies)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(caseStudies.id, id))
        .returning();
      return updated;
    }),

  publish: protectedProcedure
    .input(z.object({ id: z.string().uuid(), published: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(caseStudies)
        .set({ published: input.published, updatedAt: new Date() })
        .where(eq(caseStudies.id, input.id))
        .returning();
      return updated;
    }),

  reorder: protectedProcedure
    .input(z.array(z.object({ id: z.string().uuid(), sortOrder: z.number().int() })))
    .mutation(async ({ ctx, input }) => {
      await Promise.all(
        input.map(({ id, sortOrder }) =>
          ctx.db.update(caseStudies).set({ sortOrder, updatedAt: new Date() }).where(eq(caseStudies.id, id))
        )
      );
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.delete(caseStudies).where(eq(caseStudies.id, input.id));
    }),

  generateWithAi: publicProcedure
    .input(z.object({
      clientName: z.string().min(1),
      clientCompany: z.string().optional(),
      clientIndustry: z.string().optional(),
      projectDescription: z.string().min(10),
      outcome: z.string().min(10),
      linkedProjectId: z.string().uuid().optional().nullable(),
      linkedClientId: z.string().uuid().optional().nullable(),
    }))
    .mutation(async ({ ctx, input }) => {
      const prompt = `Generate a compelling case study testimonial and 3 impact metrics for a software project.

Client: ${input.clientName}${input.clientCompany ? ` @ ${input.clientCompany}` : ""}
Industry: ${input.clientIndustry ?? "Technology"}
Project: ${input.projectDescription}
Outcome: ${input.outcome}

Return ONLY valid JSON:
{
  "testimonial": "A 2-3 sentence first-person quote from the client praising the results",
  "clientTitle": "their likely job title",
  "metric1Label": "e.g. Revenue Increase",
  "metric1Value": "e.g. +42%",
  "metric2Label": "e.g. Time Saved",
  "metric2Value": "e.g. 15 hrs/week",
  "metric3Label": "e.g. Deployment Speed",
  "metric3Value": "e.g. 3x faster"
}`;

      const resp = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001", max_tokens: 600,
        messages: [{ role: "user", content: prompt }],
      });
      const text = resp.content[0]?.type === "text" ? resp.content[0].text.trim() : "{}";
      type GeneratedCS = {
        testimonial: string; clientTitle: string;
        metric1Label: string; metric1Value: string;
        metric2Label: string; metric2Value: string;
        metric3Label: string; metric3Value: string;
      };
      let generated: GeneratedCS = {
        testimonial: "Working with NexoFlow transformed our business.",
        clientTitle: "CEO", metric1Label: "ROI", metric1Value: "+30%",
        metric2Label: "Efficiency", metric2Value: "+50%",
        metric3Label: "Launch Time", metric3Value: "On schedule",
      };
      try { generated = { ...generated, ...(JSON.parse(text) as GeneratedCS) }; } catch { /* defaults */ }

      const initials = input.clientName.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
      const [cs] = await ctx.db.insert(caseStudies).values({
        clientName: input.clientName,
        clientTitle: generated.clientTitle,
        clientCompany: input.clientCompany,
        clientIndustry: input.clientIndustry,
        avatarInitials: initials,
        testimonial: generated.testimonial,
        metric1Label: generated.metric1Label,
        metric1Value: generated.metric1Value,
        metric2Label: generated.metric2Label,
        metric2Value: generated.metric2Value,
        metric3Label: generated.metric3Label,
        metric3Value: generated.metric3Value,
        published: false,
        linkedProjectId: input.linkedProjectId ?? null,
        linkedClientId: input.linkedClientId ?? null,
      }).returning();
      return cs;
    }),
});
