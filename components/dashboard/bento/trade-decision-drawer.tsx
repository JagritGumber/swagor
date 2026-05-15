"use client";

import { useEffect, useState } from "react";
import { X, ArrowUpRight } from "lucide-react";
import { DebugJSON } from "@/components/dashboard/debug-json";
import { LlmCallsList } from "@/components/dashboard/llm-calls-list";

const ARC_TX = "https://testnet.arcscan.app/tx/";
const SECTION_HEAD =
  "font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--neon-cyan)]";
const SUB_HEAD =
  "font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground";

type TradeRow = {
  id: string; asset: string; side: string; amountUsd: string;
  entryPrice: string | null; exitPrice: string | null; pnlUsd: string | null;
  safetyTriggerReason: string | null; status: string;
  openedAt: string | null; closedAt: string | null; proposalId: string | null;
  openAnchorTx: string | null; openOnchainTxHash: string | null;
  arcAnchorTx: string | null; arcOnchainTxHash: string | null;
  stopLossPriceUsd: string | null; takeProfitPriceUsd: string | null;
};

type RiskContext = {
  status: string;
  totalExposureUsd?: number;
  closestLiquidationDistancePct?: number | null;
  summary?: string;
  reasons?: string[];
  account?: { marginUsagePct?: number | null };
} | null;

type SymbolFeature = {
  symbol: string;
  candidateBias?: string;
  cadenceHint?: string;
  timeframes?: {
    "5m"?: { rsi14?: number | null; emaTrend?: string; marketRegime?: string; atrPct?: number | null };
    "1h"?: { marketRegime?: string };
  };
};

type TickContext = {
  marketFeatures?: { symbols?: SymbolFeature[] };
  risk?: RiskContext;
} | null;

type TickRow = {
  id: string; verdict: string; rationale: string; createdAt: string;
  context?: TickContext;
};
type ProposalRow = { id: string; reasoningTrace: string; expectedPnlPct: string | null };
type ReasoningBundle = {
  trade: TradeRow; openTick: TickRow | null; closeTick: TickRow | null; proposal: ProposalRow | null;
};

function fmtNum(value: string | number | null | undefined, digits = 2): string {
  if (value === null || value === undefined) return "n/a";
  const v = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(v)) return "n/a";
  return v.toFixed(digits);
}

function ArcLink({ hash, label }: { hash: string | null; label: string }) {
  if (!hash || hash.startsWith("failed:")) {
    return <span className="font-mono text-xs text-muted-foreground">{label}: pending</span>;
  }
  return (
    <a href={`${ARC_TX}${hash}`} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}
      className="inline-flex items-center gap-1 font-mono text-xs text-[var(--neon-cyan)] underline-offset-4 hover:underline" title={hash}>
      {label} <ArrowUpRight aria-hidden className="h-3 w-3 opacity-70" />
    </a>
  );
}

/**
 * Decision transparency drawer. Replaces TradeReasoningPanel. Adds the
 * market-context and risk-read sections so the user sees not just WHAT
 * Selbo said but what it was looking at when it decided. Raw prompts
 * stay admin-only. Triggered from trade rows, chart markers, or activity
 * tape trade events.
 */
export function TradeDecisionDrawer({
  tradeId, admin = false, onClose,
}: { tradeId: string; admin?: boolean; onClose: () => void }) {
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
      .then((b) => { if (!cancelled) setData(b); })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : String(e)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [tradeId]);

  const trade = data?.trade;
  const pnl = trade?.pnlUsd ? Number(trade.pnlUsd) : null;
  const pnlTone = pnl === null ? "text-foreground" : pnl >= 0 ? "text-[var(--neon-green)]" : "text-[var(--neon-red)]";
  const closeReason = trade?.safetyTriggerReason;
  const openCtx = data?.openTick?.context;
  const symbols = openCtx?.marketFeatures?.symbols ?? [];
  const risk = openCtx?.risk;

  return (
    <div className="mt-4 border border-[var(--hairline-strong)] bg-[#080808] p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="font-mono text-xs font-bold uppercase tracking-[0.18em] text-[var(--neon-cyan)]">Trade decision</div>
          {trade && (
            <p className="mt-2 font-mono text-base uppercase tracking-[0.14em] text-foreground">
              {trade.side} {trade.asset} <span className="text-muted-foreground">${fmtNum(trade.amountUsd)}</span>
            </p>
          )}
        </div>
        <button type="button" onClick={onClose} aria-label="Close"
          className="shrink-0 p-1 text-muted-foreground hover:text-[var(--neon-cyan)]">
          <X className="h-4 w-4" />
        </button>
      </div>

      {loading && <p className="mt-5 font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">Loading reasoning...</p>}
      {error && <p className="mt-5 font-mono text-xs uppercase tracking-[0.18em] text-[var(--neon-red)]">{error}</p>}

      {trade && (
        <>
          <div className="mt-5 border-t border-[var(--hairline)] pt-4">
            <div className={SECTION_HEAD}>Trade</div>
            <div className="mt-3 grid grid-cols-2 gap-3 font-mono text-xs sm:grid-cols-4">
              <div><div className={SUB_HEAD}>Entry</div><div className="mt-0.5 tabular-nums text-foreground">{trade.entryPrice ? `$${fmtNum(trade.entryPrice)}` : "n/a"}</div></div>
              <div><div className={SUB_HEAD}>Exit</div><div className="mt-0.5 tabular-nums text-foreground">{trade.exitPrice ? `$${fmtNum(trade.exitPrice)}` : "n/a"}</div></div>
              <div><div className={SUB_HEAD}>P/L</div><div className={`mt-0.5 tabular-nums ${pnlTone}`}>{pnl === null ? "n/a" : `${pnl >= 0 ? "+" : ""}$${fmtNum(pnl)}`}</div></div>
              <div><div className={SUB_HEAD}>Status</div><div className="mt-0.5 uppercase tracking-[0.14em] text-foreground">{trade.status}</div></div>
            </div>
            {(trade.stopLossPriceUsd || trade.takeProfitPriceUsd) && (
              <div className="mt-3 font-mono text-xs text-muted-foreground">
                {trade.stopLossPriceUsd && <span>Stop ${fmtNum(trade.stopLossPriceUsd)}</span>}
                {trade.stopLossPriceUsd && trade.takeProfitPriceUsd && <span className="mx-2">·</span>}
                {trade.takeProfitPriceUsd && <span>Take-profit ${fmtNum(trade.takeProfitPriceUsd)}</span>}
              </div>
            )}
          </div>

          <div className="mt-5 border-t border-[var(--hairline)] pt-4">
            <div className={SECTION_HEAD}>Why it opened</div>
            {data?.proposal?.reasoningTrace && <p className="mt-3 text-sm leading-relaxed text-foreground">{data.proposal.reasoningTrace}</p>}
            {data?.openTick && (
              <div className="mt-3">
                <div className={SUB_HEAD}>Triggered by watcher tick · {data.openTick.verdict}</div>
                <p className="mt-1 text-sm leading-relaxed text-foreground">{data.openTick.rationale}</p>
              </div>
            )}
            {!data?.proposal && !data?.openTick && <p className="mt-3 text-sm text-muted-foreground">No linked reasoning recorded.</p>}
          </div>

          {symbols.length > 0 && (
            <div className="mt-5 border-t border-[var(--hairline)] pt-4">
              <div className={SECTION_HEAD}>Market context at decision time</div>
              <ul className="mt-3 divide-y divide-[var(--hairline)]">
                {symbols.map((s) => (
                  <li key={s.symbol} className="grid grid-cols-[60px_1fr_auto] items-baseline gap-3 py-2 font-mono text-xs">
                    <span className="font-bold text-foreground">{s.symbol}</span>
                    <span className="text-muted-foreground">
                      5m RSI <span className="text-foreground">{fmtNum(s.timeframes?.["5m"]?.rsi14, 1)}</span>
                      <span className="mx-2">·</span>
                      EMA <span className="text-foreground">{s.timeframes?.["5m"]?.emaTrend ?? "n/a"}</span>
                      <span className="mx-2">·</span>
                      ATR <span className="text-foreground">{fmtNum(s.timeframes?.["5m"]?.atrPct)}%</span>
                      <span className="mx-2">·</span>
                      1h <span className="text-foreground">{s.timeframes?.["1h"]?.marketRegime?.replace(/_/g, " ") ?? "n/a"}</span>
                    </span>
                    <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--neon-cyan)]">
                      {(s.candidateBias ?? "unknown").replace(/_/g, " ")}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {risk && (
            <div className="mt-5 border-t border-[var(--hairline)] pt-4">
              <div className={SECTION_HEAD}>Risk read at decision time</div>
              <div className="mt-3 grid grid-cols-2 gap-3 font-mono text-xs sm:grid-cols-3">
                <div><div className={SUB_HEAD}>Status</div><div className="mt-0.5 uppercase tracking-[0.14em] text-foreground">{risk.status}</div></div>
                <div><div className={SUB_HEAD}>Exposure</div><div className="mt-0.5 tabular-nums text-foreground">${fmtNum(risk.totalExposureUsd, 0)}</div></div>
                <div><div className={SUB_HEAD}>Closest liq</div><div className="mt-0.5 tabular-nums text-foreground">{risk.closestLiquidationDistancePct === null || risk.closestLiquidationDistancePct === undefined ? "n/a" : `${fmtNum(risk.closestLiquidationDistancePct)}%`}</div></div>
              </div>
              {risk.summary && <p className="mt-3 text-sm leading-relaxed text-foreground">{risk.summary}</p>}
            </div>
          )}

          <div className="mt-5 border-t border-[var(--hairline)] pt-4">
            <div className={SECTION_HEAD}>Why it closed</div>
            {closeReason ? (
              <p className="mt-3 text-sm leading-relaxed text-foreground">
                {closeReason === "stop_loss" ? "Automatic close on stop-loss. Mark crossed the level Selbo set at open."
                  : closeReason === "take_profit" ? "Automatic close on take-profit. Mark crossed the target level."
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

          {admin && (
            <div className="mt-5 border-t border-[var(--hairline)] pt-4">
              <div className={SECTION_HEAD}>Debug (admin)</div>
              <DebugJSON title="Trade row (raw)" value={trade} />
              {data?.openTick && <DebugJSON title="Open-trigger watcher tick (raw)" value={data.openTick} />}
              {data?.closeTick && <DebugJSON title="Close-window watcher tick (raw)" value={data.closeTick} />}
              {data?.proposal && <DebugJSON title="Trade proposal (raw)" value={data.proposal} />}
              <div className="mt-3">
                <div className={SUB_HEAD}>LLM calls around this trade</div>
                <LlmCallsList tradeId={trade.id}
                  tickIds={[data?.openTick?.id, data?.closeTick?.id].filter((s): s is string => typeof s === "string")} />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
