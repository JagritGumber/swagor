/**
 * Unified activity event types. The activity tape merges watcher ticks and
 * trade open/close events into one chronological stream so the user can
 * see "what is Selbo doing" at a glance without scanning multiple cards.
 *
 * `ts` is always ISO-8601 string (serializable; the API sends strings).
 */
export type ActivityTickEvent = {
  kind: "tick";
  id: string;
  ts: string;
  verdict: "hold" | "execute" | "deliberate" | "escalate" | "risk_emergency";
  rationale: string;
  nextCheckSeconds: number;
};

export type ActivityTradeOpenEvent = {
  kind: "trade_open";
  id: string;
  ts: string;
  asset: string;
  side: "long" | "short";
  sizeUsd: string;
  entryPrice: string | null;
};

export type ActivityTradeCloseEvent = {
  kind: "trade_close";
  id: string;
  ts: string;
  asset: string;
  side: "long" | "short";
  pnlUsd: string | null;
  exitPrice: string | null;
  reason: string | null;
};

export type ActivitySafetyBlockEvent = {
  kind: "safety_block";
  id: string;
  ts: string;
  asset: string;
  attemptedAction: "open_long" | "open_short";
  code: string;
  reason: string;
};

export type ActivityEvent =
  | ActivityTickEvent
  | ActivityTradeOpenEvent
  | ActivityTradeCloseEvent
  | ActivitySafetyBlockEvent;

export type ActivityRecent = {
  events: ActivityEvent[];
  nextWatcherAt: string | null;
};
