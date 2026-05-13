import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { solonInstances } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { runWatcherForInstance } from "@/app/services/watcher/watcher.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Dev-only: run a watcher tick for the authed user's Solon instance
 * regardless of next_watcher_at.
 */
export async function POST() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user;

  const [instance] = await db
    .select().from(solonInstances).where(eq(solonInstances.userId, user.id)).limit(1);
  if (!instance) return NextResponse.json({ error: "No Solon instance" }, { status: 404 });

  try {
    const result = await runWatcherForInstance(instance.id);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
