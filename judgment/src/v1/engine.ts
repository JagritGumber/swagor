import type { Candle } from "../shared/types";
import type { OrderflowTrade, BboSnapshot } from "../shared/market/input";
import type { MarketMetrics } from "../shared/market/metrics";
import type { Judgment, JudgmentRecord } from "./judgment-types";
import type { JudgeConfig, JudgeResult } from "./judge";
import type { EngineState, EngineConfig } from "./engine-state";
import { createVolumeProfileState, addCandleToProfile } from "./update/volume-profile";
import { computeRegime, slideRegimeWindow } from "./update/regime";
import { detectSwings, updateLevels } from "./update/levels";
import { classifyPriceLocation, findNearestLevel } from "./update/price-location";
import { createEmptyOrderflowStats, addTradeToStats, recomputeOrderflowStats, expireOldTrades } from "./update/orderflow";
import { collectJudgments, pickBestJudgment } from "./judge";

export type JudgmentEngine = {
  boot(candles: Candle[]): void;
  onCandle(candle: Candle): EngineJudgmentResult;
  onTrade(trade: OrderflowTrade): EngineJudgmentResult;
  onBbo(bbo: BboSnapshot): EngineJudgmentResult;
  state(): EngineState;
  metrics(): MarketMetrics;
  history(): JudgmentRecord[];
};

export type EngineJudgmentResult = {
  judgment: Judgment;
  allJudgments: JudgeResult[];
  bestJudgment: JudgeResult | null;
};

let judgmentCounter = 0;

export function createJudgmentEngine(
  engineConfig: EngineConfig,
  judgeConfigs: JudgeConfig[],
): JudgmentEngine {
  const state: EngineState = {
    asset: engineConfig.asset,
    initialized: false,
    candles: [],
    lastCandleAt: 0,
    lastPrice: 0,
    volumeProfile: null,
    vpAnchorPrice: engineConfig.vpAnchorPrice ?? 0,
    vpRadiusPct: engineConfig.vpRadiusPct ?? 0.015,
    vpBinCount: engineConfig.vpBinCount ?? 24,
    levels: [],
    swingLeft: engineConfig.swingLeft ?? 3,
    swingRight: engineConfig.swingRight ?? 3,
    levelTolerancePct: engineConfig.levelTolerancePct ?? 0.003,
    levelMinTouches: engineConfig.levelMinTouches ?? 2,
    regime: { mode: "unknown", highVol: false, rangePct: 0, driftPct: 0, directionalEfficiency: 0 },
    regimeWindowMs: engineConfig.regimeWindowMs ?? 24 * 60 * 60 * 1000,
    trades: [],
    tradeStartIndex: 0,
    orderflowWindowMs: engineConfig.orderflowWindowMs ?? 60_000,
    bbo: null,
    bboHistory: [],
    bboStartIndex: 0,
    orderflowStats: createEmptyOrderflowStats(),
  };

  const records: JudgmentRecord[] = [];

  function buildMetrics(): MarketMetrics {
    const nearestLevel = findNearestLevel(state.lastPrice, state.levels);
    const priceLocation = classifyPriceLocation(state.lastPrice, state.volumeProfile, nearestLevel);
    return {
      lastPrice: state.lastPrice,
      lastCandleAt: state.lastCandleAt,
      volumeProfile: state.volumeProfile,
      levels: state.levels,
      regime: state.regime,
      priceLocation,
      orderflow: state.orderflowStats,
    };
  }

  function evaluate(reason: string): EngineJudgmentResult {
    const metrics = buildMetrics();
    const allJudgments = collectJudgments(judgeConfigs, metrics, state);
    const best = pickBestJudgment(allJudgments);

    const record: JudgmentRecord = {
      id: `j-${state.asset.toLowerCase()}-${Date.now().toString(36)}-${(++judgmentCounter).toString(36)}`,
      asset: state.asset,
      timestamp: Date.now(),
      action: best ? best.action : { type: "no-trade" },
      metrics,
      reason: best ? best.reason : reason,
      invalidation: best ? best.invalidation : null,
    };
    records.push(record);

    return {
      judgment: record,
      allJudgments,
      bestJudgment: best,
    };
  }

  return {
    boot(candles: Candle[]) {
      state.candles = [...candles];
      state.lastCandleAt = candles[candles.length - 1]?.t ?? 0;
      state.lastPrice = candles[candles.length - 1]?.c ?? 0;

      state.vpAnchorPrice = state.lastPrice;
      state.volumeProfile = createVolumeProfileState({
        candles,
        anchorPrice: state.vpAnchorPrice,
        radiusPct: state.vpRadiusPct,
        binCount: state.vpBinCount,
      });

      const swings = detectSwings(candles, state.swingLeft, state.swingRight);
      state.levels = updateLevels([], swings, state.levelTolerancePct, state.levelMinTouches);

      const regimeCandles = slideRegimeWindow(candles, state.regimeWindowMs, state.lastCandleAt);
      state.regime = computeRegime(regimeCandles);

      state.initialized = true;
    },

    onCandle(candle: Candle): EngineJudgmentResult {
      state.candles.push(candle);
      state.lastCandleAt = candle.t;
      state.lastPrice = candle.c;

      if (state.volumeProfile) {
        state.volumeProfile = addCandleToProfile(state.volumeProfile, candle);
      }

      const swings = detectSwings(state.candles, state.swingLeft, state.swingRight);
      state.levels = updateLevels(state.levels, swings, state.levelTolerancePct, state.levelMinTouches);

      const regimeCandles = slideRegimeWindow(state.candles, state.regimeWindowMs, state.lastCandleAt);
      state.regime = computeRegime(regimeCandles);

      state.trades = expireOldTrades(state.trades, state.orderflowWindowMs, candle.t);
      state.orderflowStats = recomputeOrderflowStats(state.trades);

      return evaluate("new candle");
    },

    onTrade(trade: OrderflowTrade): EngineJudgmentResult {
      state.trades.push(trade);
      state.lastPrice = trade.price;

      state.trades = expireOldTrades(state.trades, state.orderflowWindowMs, trade.time);
      state.orderflowStats = addTradeToStats(state.orderflowStats, trade, state.trades);

      return evaluate("new trade");
    },

    onBbo(bbo: BboSnapshot): EngineJudgmentResult {
      state.bbo = bbo;
      state.bboHistory.push(bbo);

      const cutoff = bbo.time - state.orderflowWindowMs;
      while (state.bboStartIndex < state.bboHistory.length && state.bboHistory[state.bboStartIndex].time < cutoff) {
        state.bboStartIndex++;
      }
      if (state.bboStartIndex > 100) {
        state.bboHistory = state.bboHistory.slice(state.bboStartIndex);
        state.bboStartIndex = 0;
      }

      return evaluate("new bbo");
    },

    state: () => state,
    metrics: buildMetrics,
    history: () => records,
  };
}
