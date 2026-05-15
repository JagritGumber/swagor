import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { selboInstances } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/selbo/accept-tos
 *
 * Records the user's acceptance of the paper-mode disclaimer. Idempotent
 * (sets tosAcceptedAt only when null). Unlocks the dashboard.
 */
export async function POST() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await db
    .update(selboInstances)
    .set({ tosAcceptedAt: new Date() })
    .where(eq(selboInstances.userId, session.user.id));

  return NextResponse.json({ ok: true });
}
