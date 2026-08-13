import type { JudgeConfig } from "./judge";

export const TREND_DOWN_ADVERSE: JudgeConfig = {
  id: "trend-down-adverse",
  label: "Trend-down adverse (VP active price follow)",
  regimeFilter: "trend-down",
  requireAbsorption: false,
  minTradeCount: 10,
  maxInvalidationBps: 50,
  requireActiveTape: true,
  side: "both",
};

export const CONFIRMED_ABSORPTION_TREND_DOWN: JudgeConfig = {
  id: "confirmed-absorption-trend-down",
  label: "Confirmed absorption trend-down",
  regimeFilter: "trend-down",
  requireAbsorption: true,
  minTradeCount: 10,
  maxInvalidationBps: 50,
  requireActiveTape: false,
  side: "both",
};

export const MIXED_READER_LONG: JudgeConfig = {
  id: "mixed-reader-long",
  label: "Mixed-reader long first reaction",
  regimeFilter: "all",
  requireAbsorption: false,
  minTradeCount: 10,
  maxInvalidationBps: 50,
  requireActiveTape: true,
  side: "long",
};

export const DEFAULT_JUDGE_CONFIGS: JudgeConfig[] = [
  TREND_DOWN_ADVERSE,
  CONFIRMED_ABSORPTION_TREND_DOWN,
  MIXED_READER_LONG,
];
