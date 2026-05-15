"use client";

import { useEffect, useState } from "react";
import { X, ArrowUpRight } from "lucide-react";

const ARC_TX = "https://testnet.arcscan.app/tx/";
const SECTION_HEAD =
  "font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--neon-cyan)]";
const SUB_HEAD =
  "font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground";

type TradeRow = {
  id: string;
  asset: string;
  side: string;
  amountUsd: string;
  entryPrice: string | null;
  exitPrice: string | null;
  pnlUsd: string | null;
  safetyTriggerReason: string | null;
  status: string;
  openedAt: string | null;
  closedAt: string | null;
  proposalId: string | null;
  openAnchorTx: string | null;
  openOnchainTxHash: string | null;
  arcAnchorTx: string | null;
  arcOnchainTxHash: string | null;
  stopLossPriceUsd: string | null;
  takeProfitPriceUsd: string | null;
};
type TickRow = { id: string; verdict: string; rationale: string; createdAt: string };
type ProposalRow = { id: string; reasoningTrace: string; expectedPnlPct: string | null };
type ReasoningBundle = {
  trade: TradeRow;
  openTick: TickRow | null;
  closeTick: TickRow | null;
  proposal: ProposalRow | null;
};

function fmtNum(value: string | number | null, digits = 2): string {
  if (value === null) return "n/a";
  const v = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(v)) return "n/a";
  return v.toFixed(digits);
}

function ArcLink({ hash, label }: { hash: string | null; label: string }) {
  if (!hash || hash.startsWith("failed:")) {
    return <span className="font-mono text-xs text-muted-foreground">{label}: pending</span>;
  }
  return (
    <a
      href={`${ARC_TX}${hash}`}
      target="_blank"
      rel="noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="inline-flex items-center gap-1 font-mono text-xs text-[var(--neon-cyan)] underline-offset-4 hover:underline"
      title={hash}
    >
      {label} <ArrowUpRight aria-hidden className="h-3 w-3 opacity-70" />
    </a>
  );
}

/**
 * Inline trade-reasoning panel. Rendered below the Trade History table
 * when a row is selected. Fetches /api/trades/[id]/reasoning on open
 * to pull the linked watcher tick + proposal, then renders the four
 * sections inline (no modal popup).
 */
export function TradeReasoningPanel({
  tradeId,
  onClose,
}: {
  tradeId: string;
  onClose: () => void;
}) {
  const [data, setData] = useState<ReasoningBundle | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setData(null);
    fetch(`/api/trades/${tradeId}/reasoning`, { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return (await r.json()) as ReasoningBundle;
      })
      .then((b) => {
        if (!cancelled) setData(b);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tradeId]);

  const trade = data?.trade;
  const pnl = trade?.pnlUsd ? Number(trade.pnlUsd) : null;
  const pnlTone =
    pnl === null ? "text-foreground" : pnl >= 0 ? "text-[var(--neon-green)]" : "text-[var(--neon-red)]";
  const closeReason = trade?.safetyTriggerReason;

  return (
    <div className="mt-4 border border-[var(--hairline-strong)] bg-[#080808] p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="font-mono text-xs font-bold uppercase tracking-[0.18em] text-[var(--neon-cyan)]">
            Trade detail
          </div>
          {trade && (
            <p className="mt-2 font-mono text-base uppercase tracking-[0.14em] text-foreground">
              {trade.side} {trade.asset}{" "}
              <span className="text-muted-foreground">${fmtNum(trade.amountUsd)}</span>
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="shrink-0 p-1 text-muted-foreground hover:text-[var(--neon-cyan)]"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {loading && (
        <p className="mt-5 font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
          Loading reasoning...
        </p>
      )}
      {error && (
        <p className="mt-5 font-mono text-xs uppercase tracking-[0.18em] text-[var(--neon-red)]">
          {error}
        </p>
      )}

      {trade && (
        <>
          <div className="mt-5 border-t border-[var(--hairline)] pt-4">
            <div className={SECTION_HEAD}>Trade</div>
            <div className="mt-3 grid grid-cols-2 gap-3 font-mono text-xs sm:grid-cols-4">
              <div>
                <div className={SUB_HEAD}>Entry</div>
                <div className="mt-0.5 tabular-nums text-foreground">
                  {trade.entryPrice ? `$${fmtNum(trade.entryPrice)}` : "n/a"}
                </div>
              </div>
              <div>
                <div className={SUB_HEAD}>Exit</div>
                <div className="mt-0.5 tabular-nums text-foreground">
                  {trade.exitPrice ? `$${fmtNum(trade.exitPrice)}` : "n/a"}
                </div>
              </div>
              <div>
                <div className={SUB_HEAD}>P/L</div>
                <div className={`mt-0.5 tabular-nums ${pnlTone}`}>
                  {pnl === null ? "n/a" : `${pnl >= 0 ? "+" : ""}$${fmtNum(pnl)}`}
                </div>
              </div>
              <div>
                <div className={SUB_HEAD}>Status</div>
                <div className="mt-0.5 uppercase tracking-[0.14em] text-foreground">{trade.status}</div>
              </div>
            </div>
            {(trade.stopLossPriceUsd || trade.takeProfitPriceUsd) && (
              <div className="mt-3 font-mono text-xs text-muted-foreground">
                {trade.stopLossPriceUsd && <span>Stop ${fmtNum(trade.stopLossPriceUsd)}</span>}
                {trade.stopLossPriceUsd && trade.takeProfitPriceUsd && <span className="mx-2">·</span>}
                {trade.takeProfitPriceUsd && (
                  <span>Take-profit ${fmtNum(trade.takeProfitPriceUsd)}</span>
                )}
              </div>
            )}
          </div>

          <div className="mt-5 border-t border-[var(--hairline)] pt-4">
            <div className={SECTION_HEAD}>Why it opened</div>
            {data?.proposal?.reasoningTrace && (
              <p className="mt-3 text-sm leading-relaxed text-foreground">
                {data.proposal.reasoningTrace}
              </p>
            )}
            {data?.openTick && (
              <div className="mt-3">
                <div className={SUB_HEAD}>Triggered by watcher tick · {data.openTick.verdict}</div>
                <p className="mt-1 text-sm leading-relaxed text-foreground">{data.openTick.rationale}</p>
              </div>
            )}
            {!data?.proposal && !data?.openTick && (
              <p className="mt-3 text-sm text-muted-foreground">No linked reasoning recorded.</p>
            )}
          </div>

          <div className="mt-5 border-t border-[var(--hairline)] pt-4">
            <div className={SECTION_HEAD}>Why it closed</div>
            {closeReason ? (
              <p className="mt-3 text-sm leading-relaxed text-foreground">
                {closeReason === "stop_loss"
                  ? "Automatic close on stop-loss. Mark crossed the level Selbo set at open."
                  : closeReason === "take_profit"
                    ? "Automatic close on take-profit. Mark crossed the target level."
                    : `Closed by ${closeReason}.`}
              </p>
            ) : data?.closeTick ? (
              <div className="mt-3">
                <div className={SUB_HEAD}>Closed near tick · {data.closeTick.verdict}</div>
                <p className="mt-1 text-sm leading-relaxed text-foreground">{data.closeTick.rationale}</p>
              </div>
            ) : trade.status === "closed" ? (
              <p className="mt-3 text-sm text-muted-foreground">Closed by agent decision. No linked tick recorded.</p>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">Still open.</p>
            )}
          </div>

          {(trade.openAnchorTx || trade.arcAnchorTx) && (
            <div className="mt-5 border-t border-[var(--hairline)] pt-4">
              <div className={SECTION_HEAD}>Arc proofs</div>
              <div className="mt-3 flex flex-wrap items-center gap-4">
                {trade.openAnchorTx && <ArcLink hash={trade.openOnchainTxHash} label="Open anchor" />}
                {trade.arcAnchorTx && <ArcLink hash={trade.arcOnchainTxHash} label="Close anchor" />}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
