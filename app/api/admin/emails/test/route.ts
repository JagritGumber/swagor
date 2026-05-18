import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/auth/admin";
import { sendWaitlistConfirmation } from "@/lib/email/send-waitlist-confirmation";
import { sendBetaInvite } from "@/lib/email/send-beta-invite";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({
  template: z.enum(["waitlist-confirmation", "beta-invite"]),
});

const PREVIEW_BETA_CODE = "PREVIEW-XYZ-9F2A";

/**
 * Send a test render of either email template to the admin's own
 * inbox so we can iterate on Brevo + Maizzle without spinning up a
 * fake signup. The beta-invite preview uses a fixed placeholder code
 * so the live BETA_CODE never leaks via test sends.
 */
export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(session.user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const json = await request.json().catch(() => null);
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const to = session.user.email;
  const toName = session.user.name;
  try {
    if (parsed.data.template === "waitlist-confirmation") {
      await sendWaitlistConfirmation(to, toName);
    } else {
      await sendBetaInvite(to, PREVIEW_BETA_CODE, toName);
    }
    return NextResponse.json({ ok: true, to, template: parsed.data.template });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[admin/emails/test]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
