"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight } from "lucide-react";

type ArcEvent = {
  id: string;
  type: "trade_open" | "trade_close" | "watcher_execute" | "watcher_risk_emergency" | "analysis";
  label: string;
  status: "pending" | "confirmed" | "failed";
  txId: string | null;
  onchainTxHash: string | null;
  arcscanUrl: string | null;
  createdAt: string;
};

const TYPE_LABEL: Record<ArcEvent["type"], string> = {
  trade_open: "open",
  trade_close: "close",
  watcher_execute: "execute",
  watcher_risk_emergency: "risk",
  analysis: "analysis",
};

const TYPE_TONE: Record<ArcEvent["type"], string> = {
  trade_open: "text-[var(--neon-green)]",
  trade_close: "text-[var(--neon-cyan)]",
  watcher_execute: "text-foreground",
  watcher_risk_emergency: "text-[var(--neon-red)]",
  analysis: "text-foreground",
};

const STATUS_TONE: Record<ArcEvent["status"], string> = {
  pending: "text-[var(--neon-cyan)]/70",
  confirmed: "text-[var(--neon-cyan)]",
  failed: "text-[var(--neon-red)]",
};

function agoString(when: Date): string {
  const s = Math.max(0, Math.floor((Date.now() - when.getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

/**
 * Arc-anchored decision feed. Pulls every type of Arc anchor (trade opens,
 * trade closes, watcher execute / risk_emergency) into one polled list with
 * Arcscan deep links. Hidden until the first event lands; once it does the
 * card stays mounted across refreshes.
 *
 * Drives off `/api/arc/recent` for the dashboard view; the public flagship
 * profile mounts the public variant via `components/public/public-arc-activity.tsx`.
 */
export function ArcActivityCard({
  endpoint = "/api/arc/recent",
}: { endpoint?: string }) {
  const [events, setEvents] = useState<ArcEvent[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let inFlight: AbortController | null = null;
    let cancelled = false;
    async function tick() {
      if (cancelled) return;
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        timer = setTimeout(tick, 120_000);
        return;
      }
      inFlight?.abort();
      inFlight = new AbortController();
      try {
        const res = await fetch(`${endpoint}?limit=20`, { cache: "no-store", signal: inFlight.signal });
        if (res.ok && !cancelled) {
          const data = (await res.json()) as { events?: ArcEvent[] };
          setEvents(data.events ?? []);
        }
      } catch (err) {
        if ((err as { name?: string })?.name === "AbortError") return;
      } finally {
        if (!cancelled) setLoaded(true);
      }
      if (!cancelled) timer = setTimeout(tick, 60_000);
    }
    function onVisible() {
      if (document.visibilityState !== "visible") return;
      if (timer) clearTimeout(timer);
      tick();
    }
    document.addEventListener("visibilitychange", onVisible);
    tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      inFlight?.abort();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [endpoint]);

  if (!loaded || events.length === 0) return null;

  return (
    <section className="border border-[var(--hairline-strong)] bg-black p-6">
      <header className="flex items-baseline justify-between gap-4">
        <div className="flex items-baseline gap-3">
          <span aria-hidden className="inline-block h-2.5 w-2.5 bg-[var(--neon-cyan)]" />
          <h2 className="text-2xl font-bold uppercase leading-tight text-foreground">
            Arc activity
          </h2>
        </div>
        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          anchored on arc testnet
        </span>
      </header>

      <ol className="mt-4 divide-y divide-[var(--hairline)] border-y border-[var(--hairline)]">
        {events.map((e) => (
          <li key={e.id} className="grid grid-cols-[60px_1fr_auto_auto] items-baseline gap-4 py-3">
            <span className={`font-mono text-[10px] font-bold uppercase tracking-[0.18em] ${TYPE_TONE[e.type]}`}>
              {TYPE_LABEL[e.type]}
            </span>
            <span className="truncate text-sm text-foreground">{e.label}</span>
            <span className={`font-mono text-[10px] uppercase tracking-[0.16em] ${STATUS_TONE[e.status]}`}>
              {e.status}
            </span>
            <span className="flex items-baseline gap-2 font-mono text-[11px] text-muted-foreground">
              {e.arcscanUrl ? (
                <a
                  href={e.arcscanUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[var(--neon-cyan)] hover:underline"
                >
                  arcscan <ArrowUpRight aria-hidden className="h-3 w-3 opacity-70" />
                </a>
              ) : null}
              <span>{agoString(new Date(e.createdAt))}</span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
