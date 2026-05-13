import { Webhooks } from "@polar-sh/nextjs";
import { db } from "@/lib/db/client";
import { solonInstances } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { tierFromProductId } from "@/lib/polar-client";

export const runtime = "nodejs";

/**
 * Polar webhook receiver. The `@polar-sh/nextjs` adapter handles the
 * standard-webhooks HMAC signature verification automatically — pass the
 * secret and your typed handlers, it routes the event to the right one.
 *
 * Event flow:
 *   first paid checkout -> subscription.created + order.paid
 *   monthly renewal     -> order.paid (billing_reason = subscription_cycle)
 *   tier change         -> subscription.updated
 *   user cancels        -> subscription.canceled (queued)
 *   access ends         -> subscription.revoked
 */
export const POST = Webhooks({
  webhookSecret: process.env.POLAR_WEBHOOK_SECRET ?? "",

  onSubscriptionCreated: async (payload) => {
    const sub = payload.data;
    const userId = sub.metadata?.userId as string | undefined ?? sub.customer?.externalId;
    const productId = sub.product?.id;
    const tier = productId ? tierFromProductId(productId) : null;
    if (!userId || !tier) return;
    await db.update(solonInstances).set({
      subscriptionTier: tier,
      billingCustomerId: sub.customerId,
      billingSubscriptionId: sub.id,
    }).where(eq(solonInstances.userId, userId));
  },

  onSubscriptionUpdated: async (payload) => {
    const sub = payload.data;
    const productId = sub.product?.id;
    const tier = productId ? tierFromProductId(productId) : null;
    if (!tier) return;
    await db.update(solonInstances).set({ subscriptionTier: tier })
      .where(eq(solonInstances.billingSubscriptionId, sub.id));
  },

  onSubscriptionRevoked: async (payload) => {
    await db.update(solonInstances).set({
      subscriptionTier: "free",
      billingSubscriptionId: null,
    }).where(eq(solonInstances.billingSubscriptionId, payload.data.id));
  },
});
