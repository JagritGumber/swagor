"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { WatcherTick } from "@/lib/utils/use-watcher-poll";

const VERDICT_TONE: Record<string, string> = {
  hold: "text-muted-foreground",
  execute: "text-[var(--neon-green)]",
  deliberate: "text-[var(--neon-cyan)]",
  escalate: "text-[var(--neon-cyan)]",
  risk_emergency: "text-[var(--neon-red)]",
};

function fmtNum(n: number | string | null | undefined, digits = 2): string {
  if (n === null || n === undefined) return "n/a";
  const v = typeof n === "string" ? Number(n) : n;
  if (!Number.isFinite(v)) return "n/a";
  return v.toFixed(digits);
}

function actionLabel(verdict: WatcherTick["verdict"], tier?: string): string {
  switch (verdict) {
    case "hold":
      return "Held. No action this tick.";
    case "execute":
      return "Routed to Fast Trader for a tactical entry or exit.";
    case "risk_emergency":
      return "Routed to Fast Trader for emergency protection.";
    case "deliberate":
      return tier === "free"
        ? "Downgraded to Fast Trader. Swarm deliberation is paid only."
        : "Queued for swarm deliberation across 16 perp personas.";
    case "escalate":
      return "Escalated to the panel.";
    default:
      return "Action recorded.";
  }
}

const SECTION_HEAD =
  "font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--neon-cyan)]";
const SUB_HEAD =
  "font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground";

export function TickDetailModal({
  tick,
  strategy,
  open,
  onOpenChange,
}: {
  tick: WatcherTick | null;
  strategy: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!tick) return null;
  const ctx = tick.context;
  const risk = ctx?.risk;
  const perps = ctx?.perps ?? [];
  const tier = ctx?.tier;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[85vh] w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto border border-[var(--hairline-strong)] bg-black p-6 text-foreground shadow-2xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Dialog.Title
                className={`font-mono text-xs font-bold uppercase tracking-[0.18em] ${VERDICT_TONE[tick.verdict] ?? "text-muted-foreground"}`}
              >
                {tick.verdict}
              </Dialog.Title>
              <p className="mt-2 text-base leading-relaxed text-foreground">
                {tick.rationale}
              </p>
              <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                {new Date(tick.createdAt).toLocaleString()} · next check {tick.nextCheckSeconds}s · tier {tier ?? "n/a"}
              </p>
            </div>
            <Dialog.Close
              className="shrink-0 p-1 text-muted-foreground hover:text-[var(--neon-cyan)]"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </Dialog.Close>
          </div>

          <div className="mt-6 border-t border-[var(--hairline)] pt-4">
            <div className={SECTION_HEAD}>Selbo saw</div>

            <div className="mt-3">
              <div className={SUB_HEAD}>Strategy</div>
              <p className="mt-1 text-sm leading-relaxed text-foreground">{strategy}</p>
            </div>

            {tick.watching.length > 0 && (
              <div className="mt-3">
                <div className={SUB_HEAD}>Watching</div>
                <div className="mt-1 font-mono text-sm text-foreground">
                  {tick.watching.join(", ")}
                </div>
              </div>
            )}

            {risk && (
              <div className="mt-3">
                <div className={SUB_HEAD}>Risk snapshot</div>
                <div className="mt-1 font-mono text-sm uppercase tracking-[0.14em] text-foreground">
                  {risk.status} · {risk.emergencyAction.replace(/_/g, " ")}
                </div>
                {risk.summary && (
                  <p className="mt-2 text-sm leading-relaxed text-foreground">
                    {risk.summary}
                  </p>
                )}
                <div className="mt-2 grid grid-cols-3 gap-3 font-mono text-xs">
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                      Exposure
                    </div>
                    <div className="mt-0.5 text-foreground">${fmtNum(risk.totalExposureUsd)}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                      Closest liq
                    </div>
                    <div className="mt-0.5 text-foreground">
                      {risk.closestLiquidationDistancePct !== null
                        ? `${fmtNum(risk.closestLiquidationDistancePct)}%`
                        : "n/a"}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                      Margin usage
                    </div>
                    <div className="mt-0.5 text-foreground">
                      {risk.account.marginUsagePct !== null
                        ? `${fmtNum(risk.account.marginUsagePct)}%`
                        : "n/a"}
                    </div>
                  </div>
                </div>
                {risk.reasons.length > 0 && (
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-foreground">
                    {risk.reasons.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {perps.length > 0 && (
              <div className="mt-3">
                <div className={SUB_HEAD}>Perp prices at tick</div>
                <div className="mt-1 grid grid-cols-2 gap-x-6 gap-y-1 font-mono text-xs text-foreground sm:grid-cols-3">
                  {perps.map((p) => (
                    <div key={p.symbol} className="flex items-baseline justify-between">
                      <span className="text-muted-foreground">{p.symbol}</span>
                      <span className="tabular-nums">${fmtNum(p.mid)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {(ctx?.newsCount ?? null) !== null && (
              <div className="mt-3">
                <div className={SUB_HEAD}>News scanned</div>
                <div className="mt-1 font-mono text-sm text-foreground">
                  {ctx?.newsCount ?? 0} headlines
                </div>
              </div>
            )}
          </div>

          <div className="mt-6 border-t border-[var(--hairline)] pt-4">
            <div className={SECTION_HEAD}>Selbo did</div>
            <p className="mt-3 text-sm leading-relaxed text-foreground">
              {actionLabel(tick.verdict, tier)}
            </p>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
