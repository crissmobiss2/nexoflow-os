import { eq, desc, and, inArray } from "drizzle-orm";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "../trpc";
import { leads, leadOutreach, projects, clients } from "../db/schema";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const leadInput = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  linkedIn: z.string().optional(),
  company: z.string().optional(),
  website: z.string().optional(),
  industry: z.string().optional(),
  companySize: z.string().optional(),
  region: z.string().optional(),
  jobTitle: z.string().optional(),
  techStack: z.string().optional(),
  painPoints: z.string().optional(),
  scrapedData: z.string().optional(),
  notes: z.string().optional(),
  tags: z.array(z.string()).optional(),
  source: z.enum(["csv_import", "manual", "api", "web_scraper"]).optional(),
});

const STATUS_VALUES = ["new", "reviewing", "demo_queued", "demo_generated", "sent", "replied", "won", "lost", "archived"] as const;

export const leadsRouter = createTRPCRouter({
  list: publicProcedure
    .input(z.object({
      status: z.enum(STATUS_VALUES).optional(),
      teamId: z.string().uuid().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const conditions = [];
      if (input?.status) conditions.push(eq(leads.status, input.status));
      if (input?.teamId) conditions.push(eq(leads.teamId, input.teamId));

      return ctx.db.query.leads.findMany({
        where: conditions.length > 0 ? and(...conditions) : undefined,
        with: { outreach: true },
        orderBy: [desc(leads.createdAt)],
      });
    }),

  get: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.query.leads.findFirst({
        where: eq(leads.id, input.id),
        with: { outreach: { orderBy: [desc(leadOutreach.createdAt)] }, project: true, client: true },
      });
    }),

  create: publicProcedure
    .input(leadInput)
    .mutation(async ({ ctx, input }) => {
      const [lead] = await ctx.db
        .insert(leads)
        .values({ ...input, email: input.email || null })
        .returning();
      return lead;
    }),

  update: publicProcedure
    .input(leadInput.partial().extend({
      id: z.string().uuid(),
      status: z.enum(STATUS_VALUES).optional(),
      demoUrl: z.string().optional(),
      aiInsights: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const [lead] = await ctx.db
        .update(leads)
        .set({ ...data, email: data.email || undefined, updatedAt: new Date() })
        .where(eq(leads.id, id))
        .returning();
      return lead;
    }),

  delete: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.delete(leads).where(eq(leads.id, input.id));
    }),

  importBulk: publicProcedure
    .input(z.object({
      rows: z.array(leadInput).min(1).max(500),
      teamId: z.string().uuid().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const rows = input.rows.map((r) => ({
        ...r,
        email: r.email || null,
        source: "csv_import" as const,
        teamId: input.teamId ?? null,
      }));
      const inserted = await ctx.db.insert(leads).values(rows).returning();
      return { count: inserted.length };
    }),

  generateInsights: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const lead = await ctx.db.query.leads.findFirst({
        where: eq(leads.id, input.id),
      });
      if (!lead) throw new Error("Lead not found");

      const name = [lead.firstName, lead.lastName].filter(Boolean).join(" ") || "this lead";
      const prompt = `You are a sales consultant for NexoFlow, a software development agency.

Analyze this lead and provide actionable insights for the sales team:

Name: ${name}
Company: ${lead.company ?? "Unknown"}
Title: ${lead.jobTitle ?? "Unknown"}
Industry: ${lead.industry ?? "Unknown"}
Website: ${lead.website ?? "None"}
Tech Stack: ${lead.techStack ?? "Unknown"}
Pain Points: ${lead.painPoints ?? "Not captured"}
Scraped Data: ${lead.scrapedData ?? "None"}

Respond in JSON with this exact structure:
{
  "summary": "2-3 sentence profile of the lead",
  "whatWeBuild": "What NexoFlow should propose to build for them",
  "techRecommendation": "Recommended tech stack for their project",
  "estimatedScope": "Small (1-2 weeks) | Medium (1-2 months) | Large (3-6 months)",
  "talkingPoints": ["3-5 bullet points for the sales call"],
  "redFlags": ["any concerns or risks"],
  "nextAction": "Specific recommended next step"
}`;

      const response = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }],
      });

      const text = response.content[0]?.type === "text" ? response.content[0].text : "";
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      const insights = jsonMatch ? jsonMatch[0] : text;

      const [updated] = await ctx.db
        .update(leads)
        .set({ aiInsights: insights, status: "reviewing", updatedAt: new Date() })
        .where(eq(leads.id, input.id))
        .returning();
      return updated;
    }),

  generateDemo: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const lead = await ctx.db.query.leads.findFirst({
        where: eq(leads.id, input.id),
      });
      if (!lead) throw new Error("Lead not found");

      // Create a project in NexoFlow for this lead
      const name = [lead.firstName, lead.lastName].filter(Boolean).join(" ") || lead.company || "Lead";
      const companyName = lead.company ?? name;

      let client = lead.clientId
        ? await ctx.db.query.clients.findFirst({ where: eq(clients.id, lead.clientId) })
        : null;

      if (!client) {
        const [newClient] = await ctx.db
          .insert(clients)
          .values({
            name,
            email: lead.email ?? null,
            phone: lead.phone ?? null,
            company: lead.company ?? null,
            website: lead.website ?? null,
            industry: lead.industry ?? null,
            companySize: lead.companySize ?? null,
            region: lead.region ?? null,
            existingTech: lead.techStack ?? null,
            currentChallenges: lead.painPoints ?? null,
            teamId: lead.teamId ?? null,
          })
          .returning();
        client = newClient!;
      }

      const [project] = await ctx.db
        .insert(projects)
        .values({
          name: `${companyName} — Demo`,
          clientId: client?.id ?? null,
          projectType: "web_app",
          industry: lead.industry ?? null,
          teamId: lead.teamId ?? null,
          status: "brief",
        })
        .returning();

      const [updated] = await ctx.db
        .update(leads)
        .set({
          clientId: client?.id ?? null,
          projectId: project?.id ?? null,
          status: "demo_generated",
          demoGeneratedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(leads.id, input.id))
        .returning();

      return { lead: updated, projectId: project?.id };
    }),

  sendOutreach: protectedProcedure
    .input(z.object({
      leadId: z.string().uuid(),
      channel: z.enum(["email", "whatsapp", "sms", "link"]),
      subject: z.string().optional(),
      message: z.string().min(1),
      shareLink: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [outreach] = await ctx.db
        .insert(leadOutreach)
        .values({
          leadId: input.leadId,
          channel: input.channel,
          subject: input.subject ?? null,
          message: input.message,
          shareLink: input.shareLink ?? null,
          sentBy: ctx.user?.id ?? null,
        })
        .returning();

      await ctx.db
        .update(leads)
        .set({ status: "sent", updatedAt: new Date() })
        .where(eq(leads.id, input.leadId));

      return outreach;
    }),

  generateMessage: protectedProcedure
    .input(z.object({
      leadId: z.string().uuid(),
      channel: z.enum(["email", "whatsapp", "sms", "link"]),
    }))
    .mutation(async ({ ctx, input }) => {
      const lead = await ctx.db.query.leads.findFirst({
        where: eq(leads.id, input.leadId),
      });
      if (!lead) throw new Error("Lead not found");

      const name = [lead.firstName, lead.lastName].filter(Boolean).join(" ") || "there";
      let insights: Record<string, unknown> = {};
      if (lead.aiInsights) {
        try { insights = JSON.parse(lead.aiInsights); } catch { /* ignore */ }
      }

      const channel = input.channel;
      const demoUrl = lead.demoUrl ?? "[demo link]";

      const prompt = `Write a ${channel === "email" ? "professional email" : "short message"} from NexoFlow (a software dev agency) to ${name} at ${lead.company ?? "their company"}.

Context:
- What we'd build: ${(insights.whatWeBuild as string) ?? "a custom solution for their business"}
- Their pain points: ${lead.painPoints ?? "not specified"}
- Demo link: ${demoUrl}

Write a concise, personalized outreach message. ${channel === "email" ? "Include a subject line on the first line as 'Subject: ...'." : "Keep it under 3 sentences."} Be direct, no fluff.`;

      const response = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 512,
        messages: [{ role: "user", content: prompt }],
      });

      const text = response.content[0]?.type === "text" ? response.content[0].text : "";
      let subject = "";
      let message = text;
      if (channel === "email" && text.startsWith("Subject:")) {
        const lines = text.split("\n");
        subject = lines[0]?.replace("Subject:", "").trim() ?? "";
        message = lines.slice(1).join("\n").trim();
      }

      return { subject, message };
    }),
});
