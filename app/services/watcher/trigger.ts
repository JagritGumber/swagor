import "server-only";

import { findOrCreatePortfolioForWallet, createCycle } from "@/app/services/portfolio.service";
import { runCycle } from "@/app/services/orchestrator.service";
import type { SelboInstance } from "@/lib/db/schema/selbo-instances";

/**
 * Watcher -> orchestrator handoff. On `escalate` we:
 *  1. Ensure a portfolio row exists for this Selbo instance (keyed by its
 *     auto-provisioned Circle wallet address).
 *  2. Create a `rebalance_cycles` row in 'running' status.
 *  3. Fire the existing orchestrator async; it self-anchors and writes back.
 *
 * The watcher rationale is logged into the cycle's eventual cycle_state via
 * the orchestrator (it can read the most recent monitor_ticks row for this
 * instance), so the trace page can show "selbo escalated because: X".
 */
export async function triggerCycleFromWatcher(
  instance: SelboInstance,
  watcherRationale: string,
): Promise<string> {
  const portfolio = await findOrCreatePortfolioForWallet(
    instance.userId,
    instance.circleWalletAddress,
    "paper",
  );
  const cycle = await createCycle(portfolio.id);
  // Intentionally not awaiting — the route handler returns fast.
  void runCycle(cycle.id).catch((err) => {
    console.error(`[watcher] runCycle(${cycle.id}) threw:`, err);
  });
  console.log(
    `[watcher] escalated -> cycle ${cycle.id} (instance=${instance.id}): ${watcherRationale}`,
  );
  return cycle.id;
}
