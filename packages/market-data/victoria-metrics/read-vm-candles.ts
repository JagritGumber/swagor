import type { Candle } from "@strategy-lab";
import { CANDLE_METRIC_NAMES, type CandleMetricField } from "./candle-metric-names";
import { exportVm } from "./export-vm";
import type { CandleInterval, HyperliquidNetwork, VictoriaMetricsExportSeries } from "../shared/types";

type PartialCandle = Partial<Omit<Candle, "t">> & { t: number };

export async function readVmCandles(input: {
  vmUrl: string;
  network: HyperliquidNetwork;
  asset: string;
  interval: CandleInterval;
  startMs: number;
  endMs: number;
}): Promise<Candle[]> {
  const byTime = new Map<number, PartialCandle>();
  const fields: CandleMetricField[] = ["open", "high", "low", "close", "volume"];
  for (const field of fields) {
    const series = await exportVm({
      vmUrl: input.vmUrl,
      match: `${CANDLE_METRIC_NAMES[field]}{venue="hyperliquid",network="${input.network}",asset="${input.asset.toUpperCase()}",interval="${input.interval}"}`,
      startMs: input.startMs,
      endMs: input.endMs,
    });
    mergeField(byTime, field, series);
  }
  return Array.from(byTime.values())
    .filter(isCompleteCandle)
    .sort((a, b) => a.t - b.t);
}

function mergeField(byTime: Map<number, PartialCandle>, field: CandleMetricField, exportedSeries: VictoriaMetricsExportSeries[]): void {
  for (const series of exportedSeries) {
    for (let i = 0; i < series.values.length; i++) {
      const timestamp = Math.round(series.timestamps[i]);
      const value = series.values[i];
      if (!Number.isFinite(value)) continue;
      const candle = byTime.get(timestamp) ?? { t: timestamp };
      if (field === "open") candle.o = value;
      else if (field === "high") candle.h = value;
      else if (field === "low") candle.l = value;
      else if (field === "close") candle.c = value;
      else candle.v = value;
      byTime.set(timestamp, candle);
    }
  }
}

function isCompleteCandle(candle: PartialCandle): candle is Candle {
  return Number.isFinite(candle.t)
    && Number.isFinite(candle.o)
    && Number.isFinite(candle.h)
    && Number.isFinite(candle.l)
    && Number.isFinite(candle.c)
    && Number.isFinite(candle.v);
}

