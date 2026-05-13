import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { solonInstances } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Toggle (or set) the kill switch on the authed user's Solon instance.
 */
export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user;

  const body = (await request.json().catch(() => ({}))) as { active?: boolean };

  const [current] = await db
    .select().from(solonInstances).where(eq(solonInstances.userId, user.id)).limit(1);
  if (!current) return NextResponse.json({ error: "No Solon instance" }, { status: 404 });

  const nextActive = typeof body.active === "boolean" ? body.active : !current.killSwitchActive;

  const [updated] = await db
    .update(solonInstances)
    .set({ killSwitchActive: nextActive })
    .where(eq(solonInstances.userId, user.id))
    .returning();

  return NextResponse.json({ active: updated.killSwitchActive });
}
