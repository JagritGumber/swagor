"use client";

import { createAuthClient } from "better-auth/react";
import { polarClient } from "@polar-sh/better-auth/client";
import { betterAuthUrlPublic } from "@/lib/env";

/**
 * Browser-side Better Auth client. Used by sign-in / sign-up pages and any
 * component that needs to read the session, sign out, or kick off a
 * Polar checkout / portal session from the client.
 *
 *   const { data, error } = await authClient.signIn.email({ email, password });
 *   const { data: session } = authClient.useSession();
 *   await authClient.signOut();
 *   await authClient.checkout({ slug: "basic" });
 */
export const authClient = createAuthClient({
  baseURL: betterAuthUrlPublic(),
  plugins: [polarClient()],
});
