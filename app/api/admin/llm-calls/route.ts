import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/auth/admin";
import { db } from "@/lib/db/client";
import { llmCalls } from "@/lib/db/schema";
import { or, eq, inArray, desc } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/llm-calls?tickId=&tradeId=&cycleId=&tickIds=a,b
 *
 * Admin-only audit endpoint. Returns llm_calls rows filtered by any of
 * tickId / tradeId / cycleId. tickIds is a comma-separated list (used by
 * the trade-reasoning panel to fetch open + close tick logs in one call).
 * All filters OR together. At least one must be supplied; otherwise 400.
 *
 * Order: newest first. No pagination yet -- audit volume per tick/trade is
 * 1-3 rows; revisit when an agent loops over many calls inside one tick.
 */
export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(session.user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const tickId = url.searchParams.get("tickId");
  const tradeId = url.searchParams.get("tradeId");
  const cycleId = url.searchParams.get("cycleId");
  const tickIdsParam = url.searchParams.get("tickIds");
  const tickIds = tickIdsParam
    ? tickIdsParam.split(",").map((s) => s.trim()).filter(Boolean)
    : [];

  const filters = [];
  if (tickId) filters.push(eq(llmCalls.tickId, tickId));
  if (tradeId) filters.push(eq(llmCalls.tradeId, tradeId));
  if (cycleId) filters.push(eq(llmCalls.cycleId, cycleId));
  if (tickIds.length > 0) filters.push(inArray(llmCalls.tickId, tickIds));

  if (filters.length === 0) {
    return NextResponse.json(
      { error: "Provide tickId, tradeId, cycleId, or tickIds" },
      { status: 400 },
    );
  }

  const rows = await db
    .select()
    .from(llmCalls)
    .where(filters.length === 1 ? filters[0] : or(...filters))
    .orderBy(desc(llmCalls.createdAt))
    .limit(50);

  return NextResponse.json({ rows });
}
