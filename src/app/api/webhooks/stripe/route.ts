/**
 * POST /api/webhooks/stripe
 * Handles Stripe payment events — marks invoices paid on checkout.session.completed.
 * Configure in Stripe dashboard: Webhooks → checkout.session.completed, payment_link.completed
 */

import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { invoices } from "@/server/db/schema";

export async function POST(req: NextRequest) {
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 500 });
  }

  const sig = req.headers.get("stripe-signature");
  const rawBody = await req.text();

  let event: { type: string; data: { object: Record<string, unknown> } };
  try {
    const Stripe = (await import("stripe")).default;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    event = stripe.webhooks.constructEvent(rawBody, sig ?? "", process.env.STRIPE_WEBHOOK_SECRET) as typeof event;
  } catch (err) {
    return NextResponse.json({ error: `Webhook signature invalid: ${String(err)}` }, { status: 400 });
  }

  if (event.type === "checkout.session.completed" || event.type === "payment_intent.succeeded") {
    const obj = event.data.object;
    const invoiceId = (obj.metadata as Record<string, string>)?.invoiceId;

    if (invoiceId) {
      await db
        .update(invoices)
        .set({ status: "paid", paidDate: new Date(), updatedAt: new Date() })
        .where(eq(invoices.id, invoiceId));
    }
  }

  return NextResponse.json({ received: true });
}
