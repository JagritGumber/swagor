"use client";

import { useEffect, useState } from "react";

export type WatcherRiskSnapshot = {
  status: "normal" | "watch" | "urgent" | "critical";
  emergencyAction: "none" | "tighten_stops" | "reduce_position" | "close_position";
  summary: string;
  closestLiquidationDistancePct: number | null;
  totalExposureUsd: number;
  reasons: string[];
  account: {
    equityUsd: number | null;
    withdrawableUsd: number | null;
    marginUsagePct: number | null;
  };
  positions: Array<{
    asset: string;
    side: string;
    sizeUsd: number | null;
    leverage: number | null;
    liquidationDistancePct: number | null;
    pnlPct: number | null;
    severity: "normal" | "watch" | "urgent" | "critical";
    reasons: string[];
  }>;
};

export type WatcherContext = {
  perps?: Array<{
    symbol: string;
    mid?: number | string | null;
    funding_hourly?: number | null;
  }>;
  risk?: WatcherRiskSnapshot;
  positionCount?: number;
  newsCount?: number;
  tier?: string;
};

export type WatcherTick = {
  id: string;
  verdict: "hold" | "execute" | "deliberate" | "escalate" | "risk_emergency";
  rationale: string;
  nextCheckSeconds: number;
  watching: string[];
  createdAt: string;
  context: WatcherContext | null;
};

export type WatcherRecent = {
  ticks: WatcherTick[];
  nextWatcherAt: string | null;
  currentlyWatching: string[] | null;
};

const HIDDEN_SLEEP_MS = 60_000;
const MIN_DELAY_MS = 8_000;
const MAX_DELAY_MS = 30 * 60_000;

/**
 * Cadence-aware watcher poll. Refetches the given endpoint aligned to the
 * latest tick's `nextCheckSeconds` (plus 3s skew). Pauses when the tab is
 * hidden, resumes on visibilitychange. The endpoint defaults to the
 * authenticated dashboard route; pass an absolute path like
 * `/api/selbo/${username}/recent` to drive the public flagship view.
 *
 * One subscriber per page is enough -- pass the result down rather than
 * mounting the hook in multiple components.
 */
export function useWatcherPoll(
  options: { url?: string; limit?: number } = {},
): WatcherRecent | null {
  const { url = "/api/watcher/recent", limit = 10 } = options;
  const [data, setData] = useState<WatcherRecent | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let inFlight: AbortController | null = null;
    let cancelled = false;

    function schedule(ms: number) {
      if (cancelled) return;
      const clamped = Math.max(MIN_DELAY_MS, Math.min(ms, MAX_DELAY_MS));
      timer = setTimeout(pull, clamped);
    }

    async function pull() {
      if (cancelled) return;
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        schedule(HIDDEN_SLEEP_MS);
        return;
      }
      inFlight?.abort();
      inFlight = new AbortController();
      try {
        const qs = url.includes("?") ? `&limit=${limit}` : `?limit=${limit}`;
        const res = await fetch(`${url}${qs}`, {
          cache: "no-store",
          signal: inFlight.signal,
        });
        if (!res.ok || cancelled) {
          schedule(MAX_DELAY_MS / 30);
          return;
        }
        const payload = (await res.json()) as WatcherRecent;
        setData(payload);
        const last = payload.ticks[0];
        const nextAt = last
          ? new Date(last.createdAt).getTime() + last.nextCheckSeconds * 1000 + 3000
          : Date.now() + 60_000;
        schedule(nextAt - Date.now());
      } catch (err) {
        if ((err as { name?: string })?.name === "AbortError") return;
        if (!cancelled) schedule(MAX_DELAY_MS / 30);
      }
    }

    function onVisible() {
      if (document.visibilityState !== "visible") return;
      if (timer) clearTimeout(timer);
      pull();
    }
    document.addEventListener("visibilitychange", onVisible);
    pull();

    return () => {
      cancelled = true;
      inFlight?.abort();
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [url, limit]);

  return data;
}
