import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { clampLimit, collectArcEvents } from "@/app/services/arc/events.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/arc/recent?limit=20
 *
 * Returns the calling user's most-recent Arc anchor events across three
 * sources: trade opens, trade closes, and watcher decisions (execute /
 * risk_emergency). Existing closed trades with on-chain hashes already
 * backfilled by Circle are included naturally; no migration required.
 *
 * Shared collection logic lives in @/app/services/arc/events.service so
 * Next's route-file shape check stays happy -- route files cannot export
 * non-handler names.
 */
export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const limit = clampLimit(searchParams.get("limit"));
  const events = await collectArcEvents(session.user.id, limit);
  return NextResponse.json({ events });
}
