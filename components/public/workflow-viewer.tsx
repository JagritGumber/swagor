"use client";

import { useEffect, useState } from "react";
import { useWatcherPoll } from "@/lib/utils/use-watcher-poll";

type Pos = { side: string; asset: string } | null;

const STEPS = ["Watching the markets", "Analyzing the setup", "Taking a decision", "Acting on it", "Recording the proof on-chain"];

/**
 * Selbo's loop as a human-readable vertical stepper: one connected line
 * walking down four plain-language steps, with the step Selbo is in right
 * now lit and pulsing. Driven purely off the live watcher state (verdict +
 * open position). Deliberately no engine internals -- no pipeline stage
 * names, no block codes, no on-chain jargon.
 */
function activeStep(verdict: string | undefined, position: Pos): { idx: number; headline: string; sub: string } {
  if (verdict === "risk_emergency") return { idx: 3, headline: "Managing risk", sub: "protecting the open position" };
  if (position) return { idx: 3, headline: `Holding ${position.side} ${position.asset}`, sub: "managing the open trade" };
  if (verdict === "execute") return { idx: 3, headline: "Placing a trade", sub: "opening a position" };
  if (verdict === "deliberate" || verdict === "escalate") return { idx: 2, headline: "Taking a decision", sub: "weighing the trade" };
  return { idx: 0, headline: "Watching", sub: "no clear edge yet, holding cash" };
}

function ago(iso: string | undefined, now: number): string {
  if (!iso) return "";
  const s = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 1000));
  return s < 60 ? `${s}s ago` : `${Math.floor(s / 60)}m ago`;
}

export function WorkflowViewer({ username, position, recentUrl }: { username: string; position: Pos; recentUrl?: string }) {
  const data = useWatcherPoll({ url: recentUrl ?? `/api/selbo/${encodeURIComponent(username)}/recent`, limit: 1 });
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, []);
  const tick = data?.ticks?.[0];
  const verdict = tick?.verdict;
  const watching = data?.currentlyWatching ?? [];
  const { idx, headline, sub } = activeStep(verdict, position);
  // On-chain step: a made move is already recorded (done); one being placed now is recording.
  const recordState = position ? "done" : verdict === "execute" || verdict === "risk_emergency" ? "active" : "pending";
  const thinking = tick?.rationale && !tick.rationale.includes("failed validation") ? tick.rationale : null;

  return (
    <section className="flex h-full flex-col bg-black">
      <header className="shrink-0 border-b border-[var(--hairline-strong)] px-4 py-4">
        <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.18em]">
          <span className="flex items-center gap-2 text-[var(--neon-green)]">
            <span aria-hidden className="inline-block h-2 w-2 animate-pulse bg-[var(--neon-green)]" />
            {data ? "live" : "connecting"}
          </span>
          {tick && <span className="text-muted-foreground">{ago(tick.createdAt, now)}</span>}
        </div>
        <p className="mt-2 leading-snug">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Selbo is </span>
          <span className="text-lg font-bold text-[var(--neon-cyan)]">{headline}</span>
          <span className="text-[13px] text-foreground/60"> · {sub}</span>
        </p>
        {watching.length > 0 && (
          <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{watching.join(" / ")}</p>
        )}
        {thinking && (
          <p className="mt-2 line-clamp-3 border-l-2 border-[var(--neon-cyan)]/40 pl-2 text-[12px] leading-relaxed text-foreground/60">
            {thinking}
          </p>
        )}
      </header>

      <ol className="min-h-0 flex-1 overflow-y-auto px-4 py-5">
        {STEPS.map((label, i) => {
          const last = i === STEPS.length - 1;
          const state = last ? recordState : i < idx ? "done" : i === idx ? "active" : "pending";
          const dotShell = state === "done" ? "border-[var(--neon-cyan)] bg-[var(--neon-cyan)]" : state === "active" ? "animate-pulse border-[var(--neon-cyan)] bg-[var(--neon-cyan)]/25" : "border-[var(--hairline-strong)] bg-black";
          const dotCore = state === "done" ? "bg-black" : state === "active" ? "bg-[var(--neon-cyan)]" : "bg-[var(--hairline-strong)]";
          const subLabel = state === "active" ? (last ? "recording..." : "in progress") : last && state === "done" ? "recorded on Arc" : null;
          return (
            <li key={label} className="relative grid grid-cols-[20px_1fr] gap-3 pb-6 last:pb-0">
              {!last && (
                <span aria-hidden className={`absolute left-[9px] top-5 h-[calc(100%-1.25rem)] w-px ${i < idx || (i === STEPS.length - 2 && recordState !== "pending") ? "bg-[var(--neon-cyan)]" : "bg-[var(--hairline)]"}`} />
              )}
              <span aria-hidden className={`relative z-10 mt-0.5 inline-flex h-[18px] w-[18px] items-center justify-center border ${dotShell}`}>
                <span className={`h-1.5 w-1.5 ${dotCore}`} />
              </span>
              <div className={state === "pending" ? "text-muted-foreground" : "text-foreground"}>
                <div className="text-[14px] leading-tight">{label}</div>
                {subLabel && (
                  <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--neon-cyan)]/80">{subLabel}</div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
