"use client";

import { useWatcherPoll, type WatcherTick } from "@/lib/utils/use-watcher-poll";

type Pos = { side: string; asset: string } | null;

/**
 * The "Selbo is ..." live card. Maps the latest watcher verdict + open
 * position + watchlist to a human state (watching / deliberating /
 * preparing a trade / holding / managing risk). The watcher cadence is
 * deliberately not surfaced -- users see what the agent is doing, not when
 * it next polls.
 */
function derive(verdict: WatcherTick["verdict"] | undefined, position: Pos, watching: string[]) {
  if (verdict === "risk_emergency") return { label: "MANAGING RISK", tone: "text-[var(--neon-red)]" };
  if (position) return { label: `HOLDING ${position.side.toUpperCase()} ${position.asset}`, tone: "text-[var(--neon-cyan)]" };
  if (verdict === "execute") return { label: "PREPARING A TRADE", tone: "text-[var(--neon-green)]" };
  if (verdict === "deliberate" || verdict === "escalate") return { label: "DELIBERATING", tone: "text-[var(--neon-cyan)]" };
  if (verdict === "hold") return { label: "WATCHING", tone: "text-foreground" };
  return { label: watching.length ? "WATCHING" : "INITIALIZING", tone: "text-foreground" };
}

export function AgentLiveState({ username, position }: { username: string; position: Pos }) {
  const data = useWatcherPoll({ url: `/api/selbo/${encodeURIComponent(username)}/recent`, limit: 1 });
  const tick = data?.ticks?.[0];
  const watching = data?.currentlyWatching ?? [];
  const { label, tone } = derive(tick?.verdict, position, watching);
  const detail = position
    ? `managing thesis on ${position.asset}`
    : watching.length
      ? `scanning ${watching.join(" / ")}`
      : "warming up";

  return (
    <section className="shrink-0 border-b border-[var(--hairline-strong)] bg-black px-4 py-4">
      <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--neon-green)]">
        <span aria-hidden className="inline-block h-2 w-2 animate-pulse bg-[var(--neon-green)]" />
        {data ? "live" : "connecting"}
      </div>
      <div className="mt-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Selbo is</div>
      <div className={`mt-0.5 font-mono text-xl font-bold uppercase leading-tight tracking-[0.04em] ${tone}`}>{label}</div>
      <p className="mt-1.5 truncate font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{detail}</p>
      {tick?.rationale && <p className="mt-2 line-clamp-3 text-[13px] leading-relaxed text-foreground/80">{tick.rationale}</p>}
    </section>
  );
}
