import { z } from "zod";
import { llm, MODELS } from "@/lib/llm-client";
import { extractJson } from "@/lib/llm/extract-json";

/**
 * Pure lesson extraction shared by the live memory keeper (memory.service,
 * which persists) and the backtest replay (which feeds lessons forward
 * in-memory). No DB import here so the local backtest can learn without a
 * database. The enriched input - entry thesis, setup, exit reason - lets the
 * keeper tie the OUTCOME to the READ, so a lesson captures the actual mistake
 * ("shorted into support") rather than a bare pnl.
 */
export type TradeLessonInput = {
  asset: string;
  side: string;
  sizeUsd: number;
  entryPrice: number | null;
  exitPrice: number | null;
  pnlUsd: number | null;
  pnlPct: number | null;
  entryReason?: string | null;
  setupType?: string | null;
  exitReason?: string | null;
};

export const LessonsSchema = z.object({
  outcome: z.enum(["win", "loss", "breakeven"]),
  lessons: z.array(z.string().min(8).max(220)).min(1).max(3),
});

const SYSTEM_PROMPT = `You are Selbo's memory keeper. A perp trade has closed. You are given the trade details INCLUDING the entry thesis (why Selbo opened it), the setup, and why it exited. Extract 1 to 3 plain-English lessons a future Selbo cycle should remember.

Rules:
- Each lesson is ONE sentence, specific to this trade: name the asset, side, the setup/thesis, and the concrete signal or mistake.
- Tie the OUTCOME to the THESIS. On a loss, name what about the read was wrong (e.g. "shorted SOL into a range low expecting a breakdown; it bounced - do not fade support"). On a win, name what worked so it can be repeated.
- No generic platitudes ("manage risk", "be patient"). A lesson must be useful when a similar setup appears next time.
- "outcome" must match the realized pnl sign: positive -> win, negative -> loss, ~zero -> breakeven.

Output JSON exactly:
{ "outcome": "win" | "loss" | "breakeven", "lessons": ["lesson 1", "lesson 2?", "lesson 3?"] }`;

export async function extractTradeLessons(t: TradeLessonInput): Promise<z.infer<typeof LessonsSchema>> {
  const payload = JSON.stringify({
    asset: t.asset, side: t.side, size_usd: t.sizeUsd,
    entry: t.entryPrice, exit: t.exitPrice, pnl_usd: t.pnlUsd, pnl_pct: t.pnlPct,
    entry_thesis: t.entryReason ?? null, setup: t.setupType ?? null, exit_reason: t.exitReason ?? null,
  });
  const completion = await llm.chat.completions.create({
    model: MODELS.LIGHT,
    messages: [{ role: "system", content: SYSTEM_PROMPT }, { role: "user", content: payload }],
    response_format: { type: "json_object" },
    temperature: 0.3,
  });
  const raw = completion.choices[0]?.message?.content;
  if (!raw) throw new Error("memory keeper returned empty response");
  return LessonsSchema.parse(JSON.parse(extractJson(raw)));
}
