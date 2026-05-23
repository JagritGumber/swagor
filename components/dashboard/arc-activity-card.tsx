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
  bare = false,
}: { endpoint?: string; bare?: boolean }) {
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
        const res = await fetch(`${endpoint}?limit=50`, { cache: "no-store", signal: inFlight.signal });
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

  const confirmed = events.filter((e) => e.status === "confirmed").length;

  return (
    <section className={bare ? "" : "border border-[var(--hairline-strong)] bg-black p-6"}>
      {!bare && (
        <header className="flex items-baseline justify-between gap-4">
          <div className="flex items-baseline gap-3">
            <span aria-hidden className="inline-block h-2.5 w-2.5 bg-[var(--neon-cyan)]" />
            <h2 className="text-2xl font-bold uppercase leading-tight text-foreground">
              Arc activity
            </h2>
          </div>
          <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--neon-cyan)]">
            {confirmed > 0 ? `${confirmed} verified on-chain` : "anchored on arc testnet"}
          </span>
        </header>
      )}

      <div className={`overflow-x-auto ${bare ? "" : "mt-4"}`}>
        <table className="w-full font-mono text-[10px] uppercase tracking-[0.14em]">
          <thead>
            <tr className="border-b border-[var(--neon-cyan)]/30 text-left text-muted-foreground">
              <th className="px-2 py-1">Time</th>
              <th className="px-2 py-1">Type</th>
              <th className="px-2 py-1">Detail</th>
              <th className="px-2 py-1">Status</th>
              <th className="px-2 py-1 text-right">Tx</th>
            </tr>
          </thead>
          <tbody>
            {events.map((e) => (
              <tr key={e.id} className="border-b border-[var(--neon-cyan)]/15">
                <td className="px-2 py-1 text-muted-foreground">{agoString(new Date(e.createdAt))}</td>
                <td className={`px-2 py-1 ${TYPE_TONE[e.type]}`}>{TYPE_LABEL[e.type]}</td>
                <td className="px-2 py-1 max-w-[260px] truncate text-foreground">{e.label}</td>
                <td className={`px-2 py-1 ${STATUS_TONE[e.status]}`}>{e.status}</td>
                <td className="px-2 py-1 text-right">
                  {e.arcscanUrl ? (
                    <a href={e.arcscanUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[var(--neon-cyan)] hover:underline">
                      arcscan <ArrowUpRight aria-hidden className="h-3 w-3 opacity-70" />
                    </a>
                  ) : <span className="text-muted-foreground">-</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
