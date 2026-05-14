import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { selboInstances } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { collectArcEvents } from "@/app/api/arc/recent/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Public Arc activity feed for a flagship Selbo profile. Gated on
 * publicProfile=true; the username slug must resolve to a Selbo instance
 * with the public toggle on. Returns the same ArcEvent[] shape as
 * /api/arc/recent but for the named user.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ username: string }> },
) {
  const { username } = await params;
  const { searchParams } = new URL(request.url);
  const limit = Math.min(Math.max(Number(searchParams.get("limit") ?? "20"), 1), 50);

  const [instance] = await db
    .select({ userId: selboInstances.userId })
    .from(selboInstances)
    .where(
      and(eq(selboInstances.username, username), eq(selboInstances.publicProfile, true)),
    )
    .limit(1);
  if (!instance) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const events = await collectArcEvents(instance.userId, limit);
  return NextResponse.json({ events });
}
