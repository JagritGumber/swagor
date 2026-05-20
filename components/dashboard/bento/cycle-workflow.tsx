"use client";

import { Fragment } from "react";
import { StageIcon, fmtMs, type Stage } from "./cycle-stages";

function Connector({ active }: { active: boolean }) {
  return (
    <div
      className={`mt-3 h-px w-4 shrink-0 ${active ? "bg-[var(--neon-cyan)]" : "bg-current/20"}`}
      aria-hidden="true"
    />
  );
}

function StageCard({ stage }: { stage: Stage }) {
  const tone = stage.state === "done" ? "border-[var(--neon-green)]/40"
    : stage.state === "running" ? "border-[var(--neon-cyan)] shadow-[0_0_10px_-2px_var(--neon-cyan)]"
    : stage.state === "failed" ? "border-[var(--neon-red)]/50"
    : "border-current/20";
  const isSwarm = stage.meta !== undefined;
  return (
    <div className={`flex ${isSwarm ? "min-w-[120px]" : "min-w-[84px]"} flex-col gap-1 border ${tone} bg-black/40 px-2 py-1.5`}>
      <div className="flex items-center gap-1.5">
        <StageIcon state={stage.state} />
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-foreground">{stage.label}</span>
      </div>
      <span className="font-mono text-[9px] text-muted-foreground">
        {fmtMs(stage.durationMs)}{stage.detail ? ` / ${stage.detail}` : ""}
      </span>
      {stage.meta && stage.meta.length > 0 && (
        <div className="mt-0.5 flex flex-col gap-0.5">
          {stage.meta.map((m) => (
            <span key={m} className="truncate border-l border-[var(--neon-cyan)]/40 pl-1 font-mono text-[9px] text-muted-foreground">{m}</span>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * "Selbo is digging" workflow view: the per-cycle pipeline rendered as
 * a left-to-right branching flow (start -> context -> swarm fans out to
 * its personas -> aggregate -> compile -> anchor). Running stages pulse
 * and glow; the swarm node lists the personas it consulted. Purely
 * presentational over the stages from deriveStages; no data fetching.
 */
export function CycleWorkflow({ stages }: { stages: Stage[] }) {
  return (
    <div className="flex flex-wrap items-start gap-1 border-t border-current/20 px-3 py-3">
      <div className="flex min-w-[60px] flex-col gap-1 border border-[var(--neon-green)]/40 bg-black/40 px-2 py-1.5">
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--neon-green)]">start</span>
        <span className="font-mono text-[9px] text-muted-foreground">cycle</span>
      </div>
      {stages.map((s) => (
        <Fragment key={s.label}>
          <Connector active={s.state !== "pending"} />
          <StageCard stage={s} />
        </Fragment>
      ))}
    </div>
  );
}
