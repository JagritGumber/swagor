import "server-only";
import Stripe from "stripe";

/**
 * Stripe server client. Required env: STRIPE_SECRET_KEY.
 * Per-tier price IDs: STRIPE_PRICE_BASIC, STRIPE_PRICE_PRO.
 * Webhook secret: STRIPE_WEBHOOK_SECRET (validated in /api/stripe/webhook).
 *
 * Tier -> price ID mapping resolved server-side so the price IDs never
 * leak to the client. Capital tier is contact-sales, no checkout flow.
 */
function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env: ${name}`);
  return v;
}

export const stripe = new Stripe(requireEnv("STRIPE_SECRET_KEY"), {
  apiVersion: "2025-09-30.clover",
});

export function priceIdForTier(tier: "basic" | "pro"): string {
  if (tier === "basic") return requireEnv("STRIPE_PRICE_BASIC");
  return requireEnv("STRIPE_PRICE_PRO");
}

export function tierFromPriceId(priceId: string): "basic" | "pro" | null {
  if (priceId === process.env.STRIPE_PRICE_BASIC) return "basic";
  if (priceId === process.env.STRIPE_PRICE_PRO) return "pro";
  return null;
}
