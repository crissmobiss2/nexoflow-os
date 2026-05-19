import { eq, desc, and } from "drizzle-orm";
import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "../trpc";
import { invoices, invoiceLineItems, clients, users } from "../db/schema";

const lineItemSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().int().min(1).default(1),
  rate: z.number().int().min(0).default(0),
  amount: z.number().int().min(0).default(0),
});

const invoiceInput = z.object({
  clientId: z.string().uuid().optional().nullable(),
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
  list: publicProcedure.query(async ({ ctx }) => {
    return ctx.db.query.invoices.findMany({
      with: { client: true, lineItems: true },
      orderBy: [desc(invoices.createdAt)],
    });
  }),

  get: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.query.invoices.findFirst({
        where: eq(invoices.id, input.id),
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
