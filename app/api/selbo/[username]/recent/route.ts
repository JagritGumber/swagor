import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { monitorTicks, solonInstances } from "@/lib/db/schema";
import { and, desc, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

type Params = Promise<{ username: string }>;

/**
 * Public watcher feed for a published Selbo. Returns the last N ticks for
 * the named instance, with no auth, only when publicProfile is true.
 * Locked-down profiles 404 so the page can render notFound() consistently.
 */
export async function GET(request: Request, { params }: { params: Params }) {
  const { username } = await params;
  const { searchParams } = new URL(request.url);
  const limit = Math.min(Math.max(Number(searchParams.get("limit") ?? "10"), 1), 50);

  const [instance] = await db
    .select()
    .from(solonInstances)
    .where(and(eq(solonInstances.username, username), eq(solonInstances.publicProfile, true)))
    .limit(1);

  if (!instance) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const ticks = await db
    .select({
      id: monitorTicks.id,
      verdict: monitorTicks.verdict,
      rationale: monitorTicks.rationale,
      nextCheckSeconds: monitorTicks.nextCheckSeconds,
      watching: monitorTicks.watching,
      createdAt: monitorTicks.createdAt,
    })
    .from(monitorTicks)
    .where(eq(monitorTicks.solonInstanceId, instance.id))
    .orderBy(desc(monitorTicks.createdAt))
    .limit(limit);

  // Public endpoint: let Cloudflare's CDN absorb repeat hits from link
  // previews and accidental polling spam. s-maxage drives the CDN cache,
  // max-age drives the browser cache. Both are short enough that fresh
  // ticks land in the feed within seconds of when they should.
  return NextResponse.json(
    {
      ticks,
      nextWatcherAt: instance.nextWatcherAt,
      currentlyWatching: instance.currentlyWatching,
    },
    {
      headers: {
        "Cache-Control": "public, max-age=15, s-maxage=30, stale-while-revalidate=60",
      },
    },
  );
}
