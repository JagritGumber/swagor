"use client";

import { useEffect, useState } from "react";
import { useWatcherPoll, type WatcherTick } from "@/lib/utils/use-watcher-poll";

const VERDICT_TONE: Record<WatcherTick["verdict"], string> = {
  hold: "text-muted-foreground",
  execute: "text-[var(--neon-green)]",
  deliberate: "text-[var(--neon-cyan)]",
  escalate: "text-[var(--neon-cyan)]",
  risk_emergency: "text-[var(--neon-red)]",
};

function agoString(when: Date): string {
  const s = Math.max(0, Math.floor((Date.now() - when.getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s ago`;
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m ago`;
}

function countdownString(target: Date): string {
  const s = Math.max(0, Math.floor((target.getTime() - Date.now()) / 1000));
  if (s < 60) return `in ${s}s`;
  return `in ${Math.floor(s / 60)}m ${s % 60}s`;
}

/**
 * Public live feed of a flagship Selbo's recent ticks. Same shape as the
 * dashboard WatchingStrip but driven off /api/selbo/[username]/recent, so
 * anyone with the page URL can watch Selbo think in real time.
 */
export function PublicWatchingStrip({ username }: { username: string }) {
  const data = useWatcherPoll({ url: `/api/selbo/${encodeURIComponent(username)}/recent`, limit: 10 });
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  void now;

  const ticks = data?.ticks ?? [];
  const latest = ticks[0];
  const nextAt = data?.nextWatcherAt ? new Date(data.nextWatcherAt) : null;
  const watching = data?.currentlyWatching ?? [];

  return (
    <section className="border border-[var(--hairline-strong)] bg-black p-6">
      <header className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <div className="flex items-baseline gap-3">
          <span aria-hidden className="inline-block h-2.5 w-2.5 bg-[var(--neon-cyan)]" />
          <h2 className="text-2xl font-bold uppercase leading-tight text-foreground">
            Selbo&apos;s mind
          </h2>
        </div>
        <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          {watching.length ? `watching ${watching.join(", ")}` : "no watchlist yet"}
          {nextAt ? ` · next check ${countdownString(nextAt)}` : ""}
        </div>
      </header>

      {ticks.length === 0 ? (
        <p className="mt-4 border border-dashed border-[var(--hairline-strong)] bg-[#080808] p-4 text-sm text-muted-foreground">
          No ticks yet. Selbo will start scanning shortly.
        </p>
      ) : (
        <ol className="mt-4 divide-y divide-[var(--hairline)] border-y border-[var(--hairline)]">
          {ticks.map((t, i) => (
            <li
              key={t.id}
              className="grid grid-cols-[88px_1fr_auto] items-baseline gap-4 py-3"
            >
              <span className={`font-mono text-xs font-bold uppercase tracking-[0.16em] ${VERDICT_TONE[t.verdict] ?? "text-muted-foreground"}`}>
                {t.verdict}
              </span>
              <span className="text-sm leading-relaxed text-foreground">{t.rationale}</span>
              <span className="font-mono text-[11px] text-muted-foreground">
                {i === 0 ? "now" : agoString(new Date(t.createdAt))}
              </span>
            </li>
          ))}
        </ol>
      )}

      {latest && (
        <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
          last tick {agoString(new Date(latest.createdAt))} · agent chose {latest.nextCheckSeconds}s cadence
        </p>
      )}
    </section>
  );
}
