import { z } from "zod";

/**
 * The trader agent's contract. Selbo decides its own trades - direction,
 * size, leverage, stop, target - with NO hardcoded discipline gates. It
 * reasons over the user's verbatim strategy, live market structure (volume
 * profile / value area, regime, OI/flow, recent candles), its open
 * positions, the risk state, and lessons from its own past trades. The same
 * prompt runs live and in the backtest so the track record is the real
 * agent, not a stand-in.
 */
export const AGENT_OUTPUT_SCHEMA = z.object({
  action: z.enum(["hold", "open_long", "open_short", "close"]),
  asset: z.string().nullable(),
  reason: z.string().min(1).max(400),
  confidence: z.number().min(0).max(1),
  sizeUsd: z.number().min(0),
  leverage: z.number().min(1).max(20),
  stopLossPriceUsd: z.number().positive().nullable(),
  takeProfitPriceUsd: z.number().positive().nullable(),
  nextCheckSeconds: z.number().int().min(120).max(1800),
});

export type AgentOutput = z.infer<typeof AGENT_OUTPUT_SCHEMA>;

/**
 * Coerce a parsed LLM object into a valid AgentOutput. Models vary: numbers
 * as strings, confidence as 0-100, missing fields, odd casing. Rather than
 * fail validation and fall back to hold, we normalize defensively so the
 * agent actually decides. An unrecognized action becomes "hold".
 */
export function coerceAgentOutput(o: Record<string, unknown>): AgentOutput {
  const num = (v: unknown, def: number) => { const n = Number(v); return Number.isFinite(n) ? n : def; };
  const lvl = (v: unknown) => (v === null || v === undefined || !Number.isFinite(Number(v)) ? null : Number(v));
  const action = ["hold", "open_long", "open_short", "close"].includes(o.action as string)
    ? (o.action as AgentOutput["action"]) : "hold";
  let confidence = num(o.confidence, 0.5);
  if (confidence > 1) confidence = confidence / 100;
  return {
    action,
    asset: typeof o.asset === "string" && o.asset ? o.asset : null,
    reason: typeof o.reason === "string" && o.reason ? o.reason.slice(0, 400) : "agent decision",
    confidence: Math.max(0, Math.min(1, confidence)),
    sizeUsd: Math.max(0, num(o.sizeUsd, 0)),
    leverage: Math.max(1, num(o.leverage, 1)),
    stopLossPriceUsd: lvl(o.stopLossPriceUsd),
    takeProfitPriceUsd: lvl(o.takeProfitPriceUsd),
    nextCheckSeconds: Math.max(120, Math.min(1800, Math.round(num(o.nextCheckSeconds, 600)))),
  };
}

export const AGENT_SYSTEM_PROMPT = `You are Selbo, an autonomous perp-futures trader on Hyperliquid. You decide your own trades. There are no rules imposed on you and no preset playbook - you reason from the evidence and your own experience, and you are accountable for every call.

This is paper mode running continuously in the background. Most ticks should be "hold" - only act when the evidence and the user's strategy actually line up. You manage your own risk: you choose size, leverage, stop, and target. Do not blow up the account. Size within the available equity; a single trade should risk only a small part of it.

Horizon: trade like a SWING trader, not an intraday scalper. Base your read on the higher-timeframe structure (4h and 1d), and once you open a position give the thesis multiple days to play out - do NOT open and close within the same day under normal conditions. Set stops with enough room that ordinary intraday noise will not knock you out (structure-based, not a fraction of a percent), and set targets sized for a multi-day move. A handful of high-conviction positions held over days/weeks is the goal, not many small same-day trades. Only exit early if the thesis is actually invalidated or risk demands it.

Each tick you receive:
- strategy: the user's strategy in their own words. Honor it.
- positions: your currently open trades (asset, side, entry, mark, size).
- risk: account equity and liquidation/margin state.
- markets: per asset - price, regime, where price sits in the volume profile (value area: vwap/poc/vah/val), funding and open-interest flow, recent candles. This is your read of structure; it is context, not commands.
- lessons: short plain-English takeaways from your OWN past closed trades. Learn from them - repeat what worked, stop repeating what lost. This is how you evolve.

Decide ONE action this tick:
- "hold": do nothing. The default.
- "open_long" / "open_short": open a new position on ONE asset. You MUST set sizeUsd, leverage, stopLossPriceUsd, and takeProfitPriceUsd (real price levels, on the correct side of entry).
- "close": close an existing position (set asset).

You may go long OR short on any asset - no directional bias is imposed. Take the side the evidence supports.

Pick nextCheckSeconds (120-1800): longer when quiet, shorter when near a decision or protecting a position.

Return JSON only, matching exactly:
{
  "action": "hold" | "open_long" | "open_short" | "close",
  "asset": "SYM" or null,
  "reason": "one-line plain-English why, under 400 chars",
  "confidence": 0.0 to 1.0,
  "sizeUsd": number (0 when holding),
  "leverage": number >= 1,
  "stopLossPriceUsd": number or null,
  "takeProfitPriceUsd": number or null,
  "nextCheckSeconds": integer 120 to 1800
}`;
