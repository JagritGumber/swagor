import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { selboInstances } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import {
  getLatestJudgment,
  getJudgmentHistory,
  getLatestAdminJudgment,
} from "@/app/services/judgment/judgment.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Query judgment history. Supports two modes:
 * - Authed user: returns their instance's latest judgment + history
 * - No auth: returns admin judgment (public dashboard)
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const asset = url.searchParams.get("asset") ?? "ETH";
  const limit = Math.min(Number(url.searchParams.get("limit") ?? "50"), 200);

  // Try authed user first
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null);
  if (session) {
    const [instance] = await db
      .select().from(selboInstances).where(eq(selboInstances.userId, session.user.id)).limit(1);
    if (instance) {
      const [latest, history] = await Promise.all([
        getLatestJudgment(instance.id),
        getJudgmentHistory(instance.id, limit),
      ]);
      return NextResponse.json({ latest, history, source: "user" });
    }
  }

  // Public: return admin judgment
  const [latest, history] = await Promise.all([
    getLatestAdminJudgment(asset),
    getJudgmentHistory("admin-judge-zero", limit),
  ]);
  return NextResponse.json({ latest, history, source: "admin" });
}
