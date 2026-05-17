import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { eq, desc, and } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/auth/admin";
import { db } from "@/lib/db/client";
import { selboInstances } from "@/lib/db/schema";
import { user } from "@/lib/db/schema/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Admin view of the waitlist: every selbo_instances row where
 * betaAccessGranted=false, joined with user.email so the admin can fire
 * a beta-invite from the UI. Newest signups first.
 */
export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(session.user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rows = await db.select({
    userId: selboInstances.userId,
    email: user.email,
    name: user.name,
    createdAt: selboInstances.createdAt,
    betaInviteSentAt: selboInstances.betaInviteSentAt,
  })
    .from(selboInstances)
    .innerJoin(user, eq(selboInstances.userId, user.id))
    .where(and(eq(selboInstances.betaAccessGranted, false)))
    .orderBy(desc(selboInstances.createdAt));

  return NextResponse.json({ waitlist: rows });
}
