import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { solonInstances } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { triggerCycleFromWatcher } from "@/app/services/watcher/trigger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Dev-only: bypass the watcher entirely and create a cycle directly.
 */
export async function POST() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user;

  const [instance] = await db
    .select().from(solonInstances).where(eq(solonInstances.userId, user.id)).limit(1);
  if (!instance) return NextResponse.json({ error: "No Solon instance" }, { status: 404 });

  try {
    const cycleId = await triggerCycleFromWatcher(
      instance,
      "[dev] forced escalation from dashboard test button",
    );
    return NextResponse.json({ ok: true, cycleId });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
