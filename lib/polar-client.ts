import "server-only";
import { Polar } from "@polar-sh/sdk";

/**
 * Polar.sh server client. Polar is the merchant-of-record alternative to
 * Stripe (which doesn't onboard Indian merchants). 4% + $0.40 per
 * transaction; handles VAT/GST/sales tax globally.
 *
 * Required env: POLAR_ACCESS_TOKEN (organization access token from
 * Polar dashboard -> Settings -> Developers). Sandbox + production are
 * fully isolated environments with separate dashboards and tokens.
 *
 * Product IDs (NOT price IDs — Polar uses a flatter Product model where
 * pricing is attached to the Product): POLAR_PRODUCT_BASIC, POLAR_PRODUCT_PRO.
 */
function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env: ${name}`);
  return v;
}

const isProd = process.env.POLAR_ENV === "production";

export const polar = new Polar({
  accessToken: requireEnv("POLAR_ACCESS_TOKEN"),
  server: isProd ? "production" : "sandbox",
});

export function productIdForTier(tier: "basic" | "pro"): string {
  if (tier === "basic") return requireEnv("POLAR_PRODUCT_BASIC");
  return requireEnv("POLAR_PRODUCT_PRO");
}

export function tierFromProductId(productId: string): "basic" | "pro" | null {
  if (productId === process.env.POLAR_PRODUCT_BASIC) return "basic";
  if (productId === process.env.POLAR_PRODUCT_PRO) return "pro";
  return null;
}
