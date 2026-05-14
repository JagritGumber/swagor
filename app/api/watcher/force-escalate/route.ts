import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { portfolios, rebalanceCycles, selboInstances } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import { triggerCycleFromWatcher } from "@/app/services/watcher/trigger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COOLDOWN_MS = 60_000;

/**
 * Dev-only: bypass the watcher entirely and create a cycle directly.
 * Throttled to once per 60s -- each cycle fires the full swarm of 10 +
 * tax-optimizer + critic, so a button mash here is genuinely expensive.
 */
export async function POST() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user;

  const [instance] = await db
    .select().from(selboInstances).where(eq(selboInstances.userId, user.id)).limit(1);
  if (!instance) return NextResponse.json({ error: "No Selbo instance" }, { status: 404 });

  if (!instance.betaAccessGranted) {
    return NextResponse.json(
      { ok: false, error: "Beta access required. Redeem a code first." },
      { status: 403 },
    );
  }

  // Cooldown: look at the most recent cycle on this user's portfolio
  // (keyed by wallet address) and refuse if it landed inside the window.
  const [portfolio] = await db
    .select({ id: portfolios.id })
    .from(portfolios)
    .where(eq(portfolios.walletAddress, instance.circleWalletAddress))
    .limit(1);
  if (portfolio) {
    const [lastCycle] = await db
      .select({ startedAt: rebalanceCycles.startedAt })
      .from(rebalanceCycles)
      .where(eq(rebalanceCycles.portfolioId, portfolio.id))
      .orderBy(desc(rebalanceCycles.startedAt))
      .limit(1);
    if (lastCycle?.startedAt) {
      const ageMs = Date.now() - new Date(lastCycle.startedAt).getTime();
      if (ageMs < COOLDOWN_MS) {
        const retryAfterSec = Math.ceil((COOLDOWN_MS - ageMs) / 1000);
        return NextResponse.json(
          { ok: false, error: `Cooldown: try again in ${retryAfterSec}s` },
          { status: 429, headers: { "Retry-After": String(retryAfterSec) } },
        );
      }
    }
  }

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
