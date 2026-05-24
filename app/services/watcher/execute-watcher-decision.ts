import "server-only";

import type { SelboInstance } from "@/lib/db/schema/selbo-instances";
import { openPaperTrade, closePaperTrade } from "@/app/services/trades/paper-trade.service";
import type { AnchorJsonValue } from "@/lib/arc/anchor";
import type { WatcherDecision, SelboTickInput } from "./selbo-tick-types";
import { evaluateSafetyRails } from "@/app/services/safety-rails/safety-check";
import { computeInitialRiskUsd, deriveEntryState } from "@/app/services/setup-fingerprint";

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

  const symbolFeatures = input.tickInput.marketFeatures.symbols.find((s) => s.symbol.toUpperCase() === asset);

  if (decision.action === "open_long" || decision.action === "open_short") {
    const safety = evaluateSafetyRails({ action: decision.action, asset }, input.tickInput.marketFeatures);
    if (!safety.allow) {
      console.warn(`[watcher-executor] safety rejected ${asset}: ${safety.block.reason}`);
      return;
    }
    const side = decision.action === "open_long" ? "long" : "short";
    // Read fingerprint from the SAME map the agent's payload used -- no
    // re-derive at execution time. If null, the agent's symbol wasn't in the
    // watched set this tick (rare) and we skip aggregation later on close.
    const fingerprint = input.tickInput.symbolFingerprints?.get(asset)?.[side] ?? null;
    const initialRiskUsd = mark !== null ? computeInitialRiskUsd({
      side, entryPrice: mark, stopPrice: decision.stopLossPriceUsd, sizeUsd: decision.sizeUsd,
    }) : null;
    const entryStateSnapshot = symbolFeatures
      ? deriveEntryState(symbolFeatures.perpMarketState, symbolFeatures.recentCandles)
      : null;
    await openPaperTrade({
      userId: instance.userId,
      walletId: instance.circleWalletId,
      asset, side,
      sizeUsd: decision.sizeUsd,
      entryPriceUsd: mark,
      stopLossPriceUsd: decision.stopLossPriceUsd,
      takeProfitPriceUsd: decision.takeProfitPriceUsd,
      source: "watcher",
      rationale,
      fingerprint, initialRiskUsd, entryStateSnapshot,
      agentContext: {
        decision,
        // Strip non-JSON-serializable Maps (symbolFingerprints) and the
        // setupRecordLookup closure from the anchor payload. The hash must
        // be stable across runs; everything stays in the recorded payload
        // INPUTS the agent actually consumed.
        tickInput: {
          mode: input.tickInput.mode, asOf: input.tickInput.asOf,
          strategyText: input.tickInput.strategyText,
          externalSentiment: input.tickInput.externalSentiment,
          marketFeatures: input.tickInput.marketFeatures,
          positions: input.tickInput.positions,
          risk: input.tickInput.risk,
          executionState: input.tickInput.executionState,
        },
        invariant: "trade_source=watcher_decision",
      } as unknown as AnchorJsonValue,
    });
  }

  if (decision.action === "close" || decision.action === "risk_emergency") {
    // Derive the close-state snapshot from current market features so the
    // aggregator can compute stateShifted against the entry-time snapshot.
    const closeStateSnapshot = symbolFeatures
      ? deriveEntryState(symbolFeatures.perpMarketState, symbolFeatures.recentCandles)
      : null;
    await closePaperTrade({
      userId: instance.userId,
      walletId: instance.circleWalletId,
      selboInstanceId: instance.id,
      asset,
      markPriceUsd: mark,
      source: "watcher",
      rationale,
      closeStateSnapshot,
    });
  }
}
