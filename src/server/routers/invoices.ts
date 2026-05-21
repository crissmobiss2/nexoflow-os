import { eq, desc, and } from "drizzle-orm";
import { z } from "zod";
import { createTRPCRouter, teamProcedure, publicProcedure } from "../trpc";
import { invoices, invoiceLineItems, clients, users, projects } from "../db/schema";
import { createNotification } from "@/lib/notifications";

const lineItemSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().int().min(1).default(1),
  rate: z.number().int().min(0).default(0),
  amount: z.number().int().min(0).default(0),
});

const invoiceInput = z.object({
  clientId: z.string().uuid().optional().nullable(),
  projectId: z.string().uuid().optional().nullable(),
  milestoneStep: z.number().int().min(1).max(3).optional().nullable(),
  invoiceNumber: z.string().min(1),
  status: z.enum(["draft", "sent", "paid", "overdue", "cancelled"]).default("draft"),
  subtotal: z.number().int().default(0),
  tax: z.number().int().default(0),
  total: z.number().int().default(0),
  dueDate: z.string().datetime().optional().nullable(),
  paidDate: z.string().datetime().optional().nullable(),
  notes: z.string().optional(),
  lineItems: z.array(lineItemSchema).default([]),
});

export const invoicesRouter = createTRPCRouter({
  list: teamProcedure.query(async ({ ctx }) => {
    return ctx.db.query.invoices.findMany({
      where: (t, { eq }) => eq(t.teamId, ctx.teamId),
      with: { client: true, lineItems: true },
      orderBy: [desc(invoices.createdAt)],
    });
  }),

  get: teamProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.query.invoices.findFirst({
        where: (t, { and, eq }) => and(eq(t.id, input.id), eq(t.teamId, ctx.teamId)),
        with: { client: true, lineItems: true, author: true },
      });
    }),

  create: publicProcedure
    .input(invoiceInput)
    .mutation(async ({ ctx, input }) => {
      const { lineItems: items, ...invoiceData } = input;
      const [invoice] = await ctx.db
        .insert(invoices)
        .values({
          ...invoiceData,
          dueDate: invoiceData.dueDate ? new Date(invoiceData.dueDate) : null,
          paidDate: invoiceData.paidDate ? new Date(invoiceData.paidDate) : null,
        })
        .returning();

      if (items.length > 0) {
        await ctx.db.insert(invoiceLineItems).values(
          items.map((item) => ({
            ...item,
            invoiceId: invoice.id,
          })),
        );
      }

      return ctx.db.query.invoices.findFirst({
        where: eq(invoices.id, invoice.id),
        with: { client: true, lineItems: true },
      });
    }),

  update: publicProcedure
    .input(
      invoiceInput.partial().extend({ id: z.string().uuid(), lineItems: z.array(lineItemSchema).optional() }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, lineItems: items, ...data } = input;
      const updateData: Record<string, unknown> = { ...data, updatedAt: new Date() };
      if (data.dueDate !== undefined) updateData.dueDate = data.dueDate ? new Date(data.dueDate) : null;
      if (data.paidDate !== undefined) updateData.paidDate = data.paidDate ? new Date(data.paidDate) : null;

      await ctx.db.update(invoices).set(updateData).where(eq(invoices.id, id));

      if (items !== undefined) {
        await ctx.db.delete(invoiceLineItems).where(eq(invoiceLineItems.invoiceId, id));
        if (items.length > 0) {
          await ctx.db.insert(invoiceLineItems).values(
            items.map((item) => ({ ...item, invoiceId: id })),
          );
        }
      }

      // Notify on status change
      if (data.status) {
        try {
          createNotification({
            userId: "system",
            type: "invoice",
            title: `Invoice status updated to ${data.status}`,
            message: `Invoice status changed to ${data.status}`,
            link: `/invoices/${id}`,
          });
        } catch { /* best-effort */ }
      }

      return ctx.db.query.invoices.findFirst({
        where: eq(invoices.id, id),
        with: { client: true, lineItems: true },
      });
    }),

  delete: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.delete(invoices).where(eq(invoices.id, input.id));
    }),

  createMilestoneInvoice: publicProcedure
    .input(z.object({
      projectId: z.string().uuid(),
      milestoneStep: z.enum(["1", "2", "3"]).transform(Number),
      totalBudgetCents: z.number().int().min(0),
    }))
    .mutation(async ({ ctx, input }) => {
      const [project] = await ctx.db
        .select({ id: projects.id, name: projects.name, clientId: projects.clientId, teamId: projects.teamId })
        .from(projects)
        .where(eq(projects.id, input.projectId))
        .limit(1);

      if (!project) throw new Error("Project not found");

      const MILESTONE_PCTS: Record<number, { pct: number; label: string }> = {
        1: { pct: 30, label: "Project Kickoff (30%)" },
        2: { pct: 40, label: "Project Midpoint (40%)" },
        3: { pct: 30, label: "Project Delivery (30%)" },
      };
      const milestone = MILESTONE_PCTS[input.milestoneStep]!;
      const amount = Math.round(input.totalBudgetCents * (milestone.pct / 100));

      const invoiceNumber = `INV-${Date.now().toString(36).toUpperCase()}-M${input.milestoneStep}`;

      const [invoice] = await ctx.db
        .insert(invoices)
        .values({
          clientId: project.clientId ?? null,
          projectId: project.id,
          milestoneStep: input.milestoneStep,
          invoiceNumber,
          status: "draft",
          subtotal: amount,
          total: amount,
          teamId: project.teamId ?? null,
          notes: `Milestone ${input.milestoneStep}/3 — ${milestone.label} for project: ${project.name}`,
          dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days
        })
        .returning({ id: invoices.id });

      if (invoice) {
        await ctx.db.insert(invoiceLineItems).values({
          invoiceId: invoice.id,
          description: milestone.label,
          quantity: 1,
          rate: amount,
          amount,
        });
      }

      return ctx.db.query.invoices.findFirst({
        where: eq(invoices.id, invoice!.id),
        with: { client: true, lineItems: true },
      });
    }),

  generatePdf: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // Generates a text-based invoice representation (PDF generation would require a library)
      const invoice = await ctx.db.query.invoices.findFirst({
        where: eq(invoices.id, input.id),
        with: { client: true, lineItems: true },
      });
      if (!invoice) throw new Error("Invoice not found");

      let pdf = `INVOICE\n`;
      pdf += `========\n\n`;
      pdf += `Invoice #: ${invoice.invoiceNumber}\n`;
      pdf += `Status: ${invoice.status}\n`;
      if (invoice.client) {
        pdf += `Client: ${invoice.client.name}\n`;
        pdf += `Email: ${invoice.client.email ?? "N/A"}\n`;
      }
      pdf += `\nLine Items:\n`;
      pdf += `-----------\n`;
      for (const item of invoice.lineItems) {
        pdf += `${item.description} x${item.quantity} @ ${item.rate} = ${item.amount}\n`;
      }
      pdf += `\nSubtotal: ${invoice.subtotal}\n`;
      pdf += `Tax: ${invoice.tax}\n`;
      pdf += `Total: ${invoice.total}\n`;
      if (invoice.dueDate) pdf += `Due: ${invoice.dueDate.toISOString().split("T")[0]}\n`;

      return { pdf, invoice };
    }),
});
