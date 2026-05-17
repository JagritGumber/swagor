import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/auth/admin";
import { db } from "@/lib/db/client";
import { selboInstances } from "@/lib/db/schema";
import { user } from "@/lib/db/schema/auth";
import { sendBetaInvite } from "@/lib/email/send-beta-invite";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({ userId: z.string().min(1) });

/**
 * Admin POST that delivers the BETA_CODE to a waitlisted user via Brevo.
 * Awaited (not fire-and-forget) so the admin sees a clear success/error
 * in the response. Stamps beta_invite_sent_at so /api/admin/waitlist can
 * distinguish invited vs still-waiting.
 */
export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(session.user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const json = await request.json().catch(() => null);
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  const code = process.env.BETA_CODE?.trim();
  if (!code) {
    return NextResponse.json({ error: "BETA_CODE not set; beta is open" }, { status: 410 });
  }

  const [target] = await db.select({
    instanceId: selboInstances.id,
    granted: selboInstances.betaAccessGranted,
    email: user.email,
    name: user.name,
  })
    .from(selboInstances)
    .innerJoin(user, eq(selboInstances.userId, user.id))
    .where(eq(selboInstances.userId, parsed.data.userId))
    .limit(1);
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });
  if (target.granted) return NextResponse.json({ error: "User already has beta access" }, { status: 409 });

  await sendBetaInvite(target.email, code, target.name);
  await db.update(selboInstances)
    .set({ betaInviteSentAt: new Date() })
    .where(eq(selboInstances.id, target.instanceId));

  return NextResponse.json({ ok: true, email: target.email });
}
