import "server-only";

import type { SelboInstance } from "@/lib/db/schema/selbo-instances";
import { openPaperTrade, closePaperTrade } from "@/app/services/trades/paper-trade.service";
import type { AnchorJsonValue } from "@/lib/arc/anchor";
import type { WatcherDecision, SelboTickInput } from "./selbo-tick-engine";
import { evaluateSafetyRails } from "@/app/services/safety-rails/safety-check";

export async function executeWatcherDecision(input: {
  instance: SelboInstance;
  decision: WatcherDecision;
  tickInput: SelboTickInput;
  markByAsset: Map<string, number | null>;
}): Promise<void> {
  const { instance, decision } = input;
  if (!decision.asset) return;
  const asset = decision.asset.toUpperCase();
  const mark = input.markByAsset.get(asset) ?? null;
  const rationale = `watcher: ${decision.reason}`;

  if (decision.action === "open_long" || decision.action === "open_short") {
    const safety = evaluateSafetyRails({ action: decision.action, asset }, input.tickInput.marketFeatures);
    if (!safety.allow) {
      console.warn(`[watcher-executor] safety rejected ${asset}: ${safety.block.reason}`);
      return;
    }
    await openPaperTrade({
      userId: instance.userId,
      walletId: instance.circleWalletId,
      asset,
      side: decision.action === "open_long" ? "long" : "short",
      sizeUsd: decision.sizeUsd,
      entryPriceUsd: mark,
      stopLossPriceUsd: decision.stopLossPriceUsd,
      takeProfitPriceUsd: decision.takeProfitPriceUsd,
      source: "watcher",
      rationale,
      agentContext: {
        decision,
        tickInput: input.tickInput,
        invariant: "trade_source=watcher_decision",
      } as AnchorJsonValue,
    });
  }

  if (decision.action === "close" || decision.action === "risk_emergency") {
    await closePaperTrade({
      userId: instance.userId,
      walletId: instance.circleWalletId,
      selboInstanceId: instance.id,
      asset,
      markPriceUsd: mark,
      source: "watcher",
      rationale,
    });
  }
}
