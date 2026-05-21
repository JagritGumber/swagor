"use client";

import { useWatcherPoll } from "@/lib/utils/use-watcher-poll";

type Pos = { side: string; asset: string } | null;

const STEPS = ["Watching the markets", "Analyzing the setup", "Taking a decision", "Acting on it"];

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

export function WorkflowViewer({ username, position }: { username: string; position: Pos }) {
  const data = useWatcherPoll({ url: `/api/selbo/${encodeURIComponent(username)}/recent`, limit: 1 });
  const watching = data?.currentlyWatching ?? [];
  const { idx, headline, sub } = activeStep(data?.ticks?.[0]?.verdict, position);

  return (
    <section className="flex h-full flex-col bg-black">
      <header className="shrink-0 border-b border-[var(--hairline-strong)] px-4 py-4">
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--neon-green)]">
          <span aria-hidden className="inline-block h-2 w-2 animate-pulse bg-[var(--neon-green)]" />
          {data ? "live" : "connecting"}
        </div>
        <div className="mt-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Selbo is</div>
        <div className="mt-0.5 text-xl font-bold leading-tight text-[var(--neon-cyan)]">{headline}</div>
        <p className="mt-1.5 text-[13px] leading-relaxed text-foreground/70">
          {sub}{watching.length ? ` · ${watching.join(" / ")}` : ""}
        </p>
      </header>

      <ol className="min-h-0 flex-1 overflow-y-auto px-4 py-5">
        {STEPS.map((label, i) => {
          const state = i < idx ? "done" : i === idx ? "active" : "pending";
          const last = i === STEPS.length - 1;
          return (
            <li key={label} className="relative grid grid-cols-[20px_1fr] gap-3 pb-6 last:pb-0">
              {!last && (
                <span aria-hidden className={`absolute left-[9px] top-5 h-[calc(100%-1.25rem)] w-px ${i < idx ? "bg-[var(--neon-cyan)]" : "bg-[var(--hairline)]"}`} />
              )}
              <span
                aria-hidden
                className={`relative z-10 mt-0.5 inline-flex h-[18px] w-[18px] items-center justify-center border ${
                  state === "done"
                    ? "border-[var(--neon-cyan)] bg-[var(--neon-cyan)]"
                    : state === "active"
                      ? "animate-pulse border-[var(--neon-cyan)] bg-[var(--neon-cyan)]/25"
                      : "border-[var(--hairline-strong)] bg-black"
                }`}
              >
                <span className={`h-1.5 w-1.5 ${state === "done" ? "bg-black" : state === "active" ? "bg-[var(--neon-cyan)]" : "bg-[var(--hairline-strong)]"}`} />
              </span>
              <div className={state === "pending" ? "text-muted-foreground" : "text-foreground"}>
                <div className="text-[14px] leading-tight">{label}</div>
                {state === "active" && (
                  <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--neon-cyan)]">in progress</div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
