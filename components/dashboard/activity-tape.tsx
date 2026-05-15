"use client";

import { useEffect, useState } from "react";
import { useActivityPoll } from "@/lib/utils/use-activity-poll";
import { ActivityRow } from "@/components/dashboard/activity-row";

function countdown(target: Date, now: number): string {
  const s = Math.max(0, Math.floor((target.getTime() - now) / 1000));
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

/**
 * Live unified activity tape. Watcher ticks, trade opens, and trade
 * closes are all merged into one chronological stream so the user sees
 * "what Selbo just did" without scanning multiple cards. Polls aligned
 * to the next watcher tick; relative timestamps tick every second so the
 * dashboard feels alive even between fetches.
 */
export function ActivityTape({ limit = 30 }: { limit?: number }) {
  const data = useActivityPoll(limit);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const events = data?.events ?? [];
  const nextAt = data?.nextWatcherAt ? new Date(data.nextWatcherAt) : null;
  const pulse =
    nextAt && nextAt.getTime() - now < 3000 && nextAt.getTime() - now > -2000;

  return (
    <section className="border border-[var(--hairline-strong)] bg-black p-6">
      <header className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <div className="flex items-baseline gap-3">
          <span
            aria-hidden
            className={`inline-block h-2.5 w-2.5 bg-[var(--neon-cyan)] ${pulse ? "animate-pulse" : ""}`}
          />
          <h2 className="text-2xl font-bold uppercase leading-tight text-foreground">
            Activity
          </h2>
        </div>
        <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          {nextAt ? `next check in ${countdown(nextAt, now)}` : "warming up"}
          {events[0] && ` · last event ${Math.max(0, Math.floor((now - new Date(events[0].ts).getTime()) / 1000))}s ago`}
        </div>
      </header>

      {events.length === 0 ? (
        <p className="mt-4 border border-dashed border-[var(--hairline-strong)] bg-[#080808] p-4 text-sm text-muted-foreground">
          No activity yet. Selbo will start scanning shortly.
        </p>
      ) : (
        <ol className="mt-4 divide-y divide-[var(--hairline)] border-y border-[var(--hairline)]">
          {events.map((e) => (
            <li key={`${e.kind}:${e.id}:${e.ts}`}>
              <ActivityRow event={e} now={now} />
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
