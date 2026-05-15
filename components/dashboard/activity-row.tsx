"use client";

import { ArrowDownRight, ArrowUpRight, ShieldAlert } from "lucide-react";
import type { ActivityEvent } from "@/lib/utils/activity-events";

const VERDICT_DOT: Record<string, string> = {
  hold: "bg-muted-foreground",
  execute: "bg-[var(--neon-green)]",
  deliberate: "bg-[var(--neon-cyan)]",
  escalate: "bg-[var(--neon-cyan)]",
  risk_emergency: "bg-[var(--neon-red)]",
};

const VERDICT_LABEL: Record<string, string> = {
  hold: "HOLD",
  execute: "EXECUTE",
  deliberate: "DELIBERATE",
  escalate: "ESCALATE",
  risk_emergency: "RISK EMERGENCY",
};

function fmtUsd(s: string | null): string {
  if (s === null) return "n/a";
  const n = Number(s);
  if (!Number.isFinite(n)) return "n/a";
  return n >= 1000 ? `$${n.toFixed(0)}` : `$${n.toFixed(2)}`;
}

function agoString(ts: string, now: number): string {
  const ms = now - new Date(ts).getTime();
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`;
  if (s < 86_400) return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
  return `${Math.floor(s / 86_400)}d`;
}

const ROW =
  "grid w-full grid-cols-[16px_120px_1fr_56px] items-baseline gap-3 py-2.5 text-left";

/**
 * One row in the activity tape. Discriminates by event.kind. Returns a
 * static block (no click expansion -- each row is self-contained). Trade
 * rows have an icon for side; risk-emergency ticks have a shield icon.
 */
export function ActivityRow({ event, now }: { event: ActivityEvent; now: number }) {
  if (event.kind === "tick") {
    const isEmergency = event.verdict === "risk_emergency";
    return (
      <div className={ROW}>
        <span aria-hidden className={`h-2 w-2 self-center ${VERDICT_DOT[event.verdict] ?? "bg-muted-foreground"}`} />
        <span className={`font-mono text-[11px] font-bold uppercase tracking-[0.14em] ${isEmergency ? "text-[var(--neon-red)]" : "text-foreground"}`}>
          {isEmergency && <ShieldAlert className="mr-1 inline h-3 w-3" aria-hidden />}
          {VERDICT_LABEL[event.verdict] ?? event.verdict}
        </span>
        <span className="text-sm leading-relaxed text-foreground">{event.rationale}</span>
        <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
          {agoString(event.ts, now)}
        </span>
      </div>
    );
  }
  if (event.kind === "trade_open") {
    const Arrow = event.side === "long" ? ArrowUpRight : ArrowDownRight;
    const tone = event.side === "long" ? "text-[var(--neon-green)]" : "text-[var(--neon-cyan)]";
    return (
      <div className={ROW}>
        <span aria-hidden className="h-2 w-2 self-center bg-[var(--neon-cyan)]" />
        <span className={`font-mono text-[11px] font-bold uppercase tracking-[0.14em] ${tone}`}>
          <Arrow aria-hidden className="mr-1 inline h-3 w-3" />OPENED
        </span>
        <span className="text-sm leading-relaxed text-foreground">
          {event.side.toUpperCase()} {event.asset} {fmtUsd(event.sizeUsd)}
          {event.entryPrice && <span className="text-muted-foreground"> @ {fmtUsd(event.entryPrice)}</span>}
        </span>
        <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
          {agoString(event.ts, now)}
        </span>
      </div>
    );
  }
  if (event.kind === "safety_block") {
    return (
      <div className={ROW}>
        <span aria-hidden className="h-2 w-2 self-center bg-[var(--neon-red)]" />
        <span className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--neon-red)]">
          <ShieldAlert aria-hidden className="mr-1 inline h-3 w-3" />BLOCKED
        </span>
        <span className="text-sm leading-relaxed text-foreground">
          {event.attemptedAction.replace("_", " ").toUpperCase()} {event.asset}:{" "}
          <span className="text-muted-foreground">{event.reason}</span>
        </span>
        <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
          {agoString(event.ts, now)}
        </span>
      </div>
    );
  }
  const pnl = event.pnlUsd === null ? null : Number(event.pnlUsd);
  const pnlTone =
    pnl === null ? "text-muted-foreground" : pnl >= 0 ? "text-[var(--neon-green)]" : "text-[var(--neon-red)]";
  return (
    <div className={ROW}>
      <span aria-hidden className={`h-2 w-2 self-center ${pnl !== null && pnl >= 0 ? "bg-[var(--neon-green)]" : "bg-[var(--neon-red)]"}`} />
      <span className={`font-mono text-[11px] font-bold uppercase tracking-[0.14em] ${pnlTone}`}>CLOSED</span>
      <span className="text-sm leading-relaxed text-foreground">
        {event.side.toUpperCase()} {event.asset}{" "}
        <span className={`font-mono tabular-nums ${pnlTone}`}>
          {pnl === null ? "" : `${pnl >= 0 ? "+" : ""}${fmtUsd(event.pnlUsd)}`}
        </span>
        {event.reason && (
          <span className="text-muted-foreground"> ({event.reason.replace(/_/g, " ")})</span>
        )}
      </span>
      <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
        {agoString(event.ts, now)}
      </span>
    </div>
  );
}
