import type { Candle } from "../../strategy-lab";
import { CANDLE_METRIC_NAMES } from "./candle-metric-names";
import { prometheusLabels } from "./prometheus-labels";
import type { CandleInterval, HyperliquidNetwork } from "../shared/types";

export function buildVmCandleLines(input: {
  network: HyperliquidNetwork;
  asset: string;
  interval: CandleInterval;
  candles: Candle[];
}): string {
  const labels = prometheusLabels({
    venue: "hyperliquid",
    network: input.network,
    asset: input.asset.toUpperCase(),
    interval: input.interval,
  });
  const lines: string[] = [];
  for (const candle of input.candles) {
    lines.push(`${CANDLE_METRIC_NAMES.open}{${labels}} ${candle.o} ${candle.t}`);
    lines.push(`${CANDLE_METRIC_NAMES.high}{${labels}} ${candle.h} ${candle.t}`);
    lines.push(`${CANDLE_METRIC_NAMES.low}{${labels}} ${candle.l} ${candle.t}`);
    lines.push(`${CANDLE_METRIC_NAMES.close}{${labels}} ${candle.c} ${candle.t}`);
    lines.push(`${CANDLE_METRIC_NAMES.volume}{${labels}} ${candle.v} ${candle.t}`);
  }
  return `${lines.join("\n")}\n`;
}
