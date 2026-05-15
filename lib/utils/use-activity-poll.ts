"use client";

import { useEffect, useState } from "react";
import type { ActivityRecent } from "@/lib/utils/activity-events";

const HIDDEN_SLEEP_MS = 60_000;
const MIN_DELAY_MS = 8_000;
const MAX_DELAY_MS = 30 * 60_000;
const FALLBACK_MS = 30_000;

/**
 * Cadence-aware poll for /api/activity/recent. Aligns the next refetch to
 * `nextWatcherAt + 3s` so a new tick lands in the feed within a second of
 * the watcher writing it. Pauses when the tab is hidden; resumes on
 * visibilitychange. Same shape as useWatcherPoll but for the unified feed.
 */
export function useActivityPoll(limit = 30): ActivityRecent | null {
  const [data, setData] = useState<ActivityRecent | null>(null);

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
        const res = await fetch(`/api/activity/recent?limit=${limit}`, {
          cache: "no-store",
          signal: inFlight.signal,
        });
        if (!res.ok || cancelled) {
          schedule(FALLBACK_MS);
          return;
        }
        const payload = (await res.json()) as ActivityRecent;
        setData(payload);
        const nextAt = payload.nextWatcherAt
          ? new Date(payload.nextWatcherAt).getTime() + 3000
          : Date.now() + FALLBACK_MS;
        schedule(nextAt - Date.now());
      } catch (err) {
        if ((err as { name?: string })?.name === "AbortError") return;
        if (!cancelled) schedule(FALLBACK_MS);
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
  }, [limit]);

  return data;
}
