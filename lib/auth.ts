import "server-only";

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { polar, checkout, portal, webhooks } from "@polar-sh/better-auth";
import { Polar } from "@polar-sh/sdk";
import { db } from "@/lib/db/client";
import { betterAuthUrlServer } from "@/lib/env";

/**
 * Better Auth server singleton. Owns identity, sessions, credentials,
 * email verification. Drizzle-adapter writes to the same Postgres our app
 * already uses (Supabase Postgres, but Supabase's own auth.users is
 * no longer touched).
 *
 * The Polar plugin auto-provisions a Polar customer on every signup,
 * exposes /api/auth/checkout/<slug> + /api/auth/portal endpoints, and
 * receives Polar webhooks at /api/auth/polar/webhooks. Our previous
 * hand-rolled /api/polar/* routes are now redundant.
 *
 * Required env: BETTER_AUTH_SECRET (32+ chars), BETTER_AUTH_URL,
 * POLAR_ACCESS_TOKEN, POLAR_WEBHOOK_SECRET, POLAR_PRODUCT_BASIC,
 * POLAR_PRODUCT_PRO.
 */
function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env: ${name}`);
  return v;
}

const polarClient = new Polar({
  accessToken: requireEnv("POLAR_ACCESS_TOKEN"),
  server: process.env.POLAR_ENV === "production" ? "production" : "sandbox",
});

const RESOLVED_AUTH_URL = betterAuthUrlServer();

export const auth = betterAuth({
  secret: requireEnv("BETTER_AUTH_SECRET"),
  baseURL: RESOLVED_AUTH_URL,
  database: drizzleAdapter(db, { provider: "pg" }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    autoSignIn: true,
  },
  trustedOrigins: [RESOLVED_AUTH_URL],
  plugins: [
    polar({
      client: polarClient,
      createCustomerOnSignUp: true,
      use: [
        checkout({
          products: [
            { productId: requireEnv("POLAR_PRODUCT_BASIC"), slug: "basic" },
            { productId: requireEnv("POLAR_PRODUCT_PRO"), slug: "pro" },
          ],
          successUrl: `${RESOLVED_AUTH_URL}/dashboard?checkout=success`,
          authenticatedUsersOnly: true,
        }),
        portal(),
        webhooks({
          secret: requireEnv("POLAR_WEBHOOK_SECRET"),
        }),
      ],
    }),
    // nextCookies must be the last plugin so it can wrap the response.
    nextCookies(),
  ],
});

export type Session = typeof auth.$Infer.Session;
