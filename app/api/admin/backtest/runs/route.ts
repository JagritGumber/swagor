import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/auth/admin";
import { db } from "@/lib/db/client";
import { backtestRuns } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * List the caller's backtest runs, newest first. Capped at 20 rows.
 */
export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(session.user.email)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const rows = await db.select().from(backtestRuns)
    .where(eq(backtestRuns.userId, session.user.id))
    .orderBy(desc(backtestRuns.createdAt))
    .limit(20);

  return NextResponse.json({ runs: rows });
}
