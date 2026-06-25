import type { ReaderHypothesis } from "./types";

export const defaultReaderHypotheses: ReaderHypothesis[] = [
  {
    id: "vp-active-long-first-reaction-nonnegative",
    label: "VP active long, first reaction non-negative",
    description: "Mixed VP pullback candidate family with tight invalidation, active tape, long side, and no adverse first reaction.",
    kind: "mixed-reader",
    filters: {
      side: "long",
      minInvalidationBps: 2,
      maxInvalidationBps: 5,
      minTradeCount: 500,
      maxTradeCount: 1000,
      maxAbsResultR: 100,
    },
    confirmation: {
      type: "first-reaction",
      thresholdR: 0,
    },
  },
  {
    id: "vp-trend-down-active-price-follow-025",
    label: "VP trend-down active tape, 0.25R price follow",
    description: "Adverse-reader trend-down pullback family with tight invalidation, active tape, and 0.25R price-follow confirmation.",
    kind: "adverse-reader",
    filters: {
      regime: "trend-down",
      minInvalidationBps: 2,
      maxInvalidationBps: 5,
      minTradeCount: 500,
      maxTradeCount: 1000,
      maxAbsResultR: 100,
    },
    confirmation: {
      type: "max-favorable",
      thresholdR: 0.25,
    },
  },
  {
    id: "vp-confirmed-absorption-trend-down-price-follow-025",
    label: "VP confirmed absorption trend-down, 0.25R price follow",
    description: "Concentrated adverse-reader absorption setup with trend-down regime and 0.25R price-follow confirmation.",
    kind: "adverse-reader",
    filters: {
      regime: "trend-down",
      event: "confirmed-absorption",
      minInvalidationBps: 2,
      maxInvalidationBps: 5,
      minTradeCount: 500,
      maxTradeCount: 1000,
      maxAbsResultR: 100,
    },
    confirmation: {
      type: "max-favorable",
      thresholdR: 0.25,
    },
  },
  {
    id: "trend-pullback-continuation-price-follow-025",
    label: "Trend-pullback continuation, 0.25R price follow",
    description: "Trend-following continuation family with tight invalidation and 0.25R price-follow confirmation.",
    kind: "trend-following",
    filters: {
      family: "trend-continuation",
      minInvalidationBps: 2,
      maxInvalidationBps: 5,
      minTradeCount: 0,
      maxTradeCount: 1000,
      maxAbsResultR: 100,
    },
    confirmation: {
      type: "max-favorable",
      thresholdR: 0.25,
    },
  },
  {
    id: "trend-pullback-long-thin-immediate",
    label: "Trend-pullback long thin immediate baseline",
    description: "Long trend-pullback baseline with tight invalidation and thin orderflow participation.",
    kind: "trend-following",
    filters: {
      side: "long",
      minInvalidationBps: 2,
      maxInvalidationBps: 5,
      minTradeCount: 0,
      maxTradeCount: 250,
      maxAbsResultR: 100,
    },
    confirmation: {
      type: "none",
      thresholdR: 0,
    },
  },
];


