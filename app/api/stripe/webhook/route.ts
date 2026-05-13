import { NextResponse } from "next/server";
import { stripe, tierFromPriceId } from "@/lib/stripe-client";
import { db } from "@/lib/db/client";
import { solonInstances } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import type Stripe from "stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Stripe webhook receiver. Verifies signature, maps subscription events to
 * the user's solon_instances row, updates subscription_tier accordingly.
 * Uses constructEventAsync (Web Crypto) so it works on Cloudflare Workers
 * runtime as well as Node.
 */
export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });

  const sig = request.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "Missing signature" }, { status: 400 });

  const raw = await request.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(raw, sig, secret);
  } catch (e) {
    console.error("[stripe webhook] signature verification failed:", e);
    return NextResponse.json({ error: "Bad signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = (session.metadata?.userId as string | undefined) ?? session.client_reference_id;
        const tier = session.metadata?.tier as "basic" | "pro" | undefined;
        if (!userId || !tier) break;
        await db.update(solonInstances).set({
          subscriptionTier: tier,
          stripeCustomerId: typeof session.customer === "string" ? session.customer : null,
          stripeSubscriptionId: typeof session.subscription === "string" ? session.subscription : null,
        }).where(eq(solonInstances.userId, userId));
        break;
      }
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const priceId = sub.items.data[0]?.price.id;
        const tier = priceId ? tierFromPriceId(priceId) : null;
        if (!tier) break;
        await db.update(solonInstances).set({ subscriptionTier: tier })
          .where(eq(solonInstances.stripeSubscriptionId, sub.id));
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        await db.update(solonInstances).set({
          subscriptionTier: "free",
          stripeSubscriptionId: null,
        }).where(eq(solonInstances.stripeSubscriptionId, sub.id));
        break;
      }
    }
    return NextResponse.json({ received: true });
  } catch (e) {
    console.error("[stripe webhook]", event.type, e);
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }
}
