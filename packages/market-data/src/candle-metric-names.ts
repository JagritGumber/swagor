export const CANDLE_METRIC_NAMES = {
  open: "market_candle_open",
  high: "market_candle_high",
  low: "market_candle_low",
  close: "market_candle_close",
  volume: "market_candle_volume",
} as const;

export type CandleMetricField = keyof typeof CANDLE_METRIC_NAMES;
