import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

/**
 * Better Auth's catch-all route handler. Handles every auth endpoint:
 *   /api/auth/sign-in/email     /api/auth/sign-up/email
 *   /api/auth/sign-out          /api/auth/get-session
 *   /api/auth/checkout/<slug>   /api/auth/portal       (Polar plugin)
 *   /api/auth/polar/webhooks                            (Polar webhook receiver)
 * Configure Polar webhook URL in dashboard to point here.
 */
export const { GET, POST } = toNextJsHandler(auth);
