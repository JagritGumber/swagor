import "server-only";

import { z } from "zod";
import { db } from "@/lib/db/client";
import { memoryEntries, type Trade } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import { llm, MODELS } from "@/lib/llm-client";

const LessonsSchema = z.object({
  outcome: z.enum(["win", "loss", "breakeven"]),
  lessons: z.array(z.string().min(8).max(220)).min(1).max(3),
});

const SYSTEM_PROMPT = `You are Selbo's memory keeper. A perp trade has closed. Given the trade details, extract 1 to 3 plain-English lessons a future Selbo cycle should remember.

Rules:
- Each lesson is ONE sentence, specific to what actually happened in this trade.
- Reference the asset, side, and the concrete signal or mistake. Avoid generic platitudes ("manage risk", "be patient").
- A lesson should be useful as a reminder when a similar setup appears next time.
- "outcome" must match the realized pnlPct sign: positive -> win, negative -> loss, ~zero -> breakeven.

Output JSON exactly:
{
  "outcome": "win" | "loss" | "breakeven",
  "lessons": ["lesson 1", "lesson 2?", "lesson 3?"]
}`;

function classifyOutcome(pnlPct: number | null): "win" | "loss" | "breakeven" {
  if (pnlPct === null || Math.abs(pnlPct) < 0.5) return "breakeven";
  return pnlPct > 0 ? "win" : "loss";
}

/**
 * Insert a memory entry for a closed trade. LIGHT LLM extracts 1-3
 * one-sentence lessons. Non-fatal: errors are logged and swallowed so a
 * memory failure cannot break the trade settle path.
 */
export async function recordTradeMemory(trade: Trade): Promise<void> {
  if (trade.status !== "closed") return;
  const entry = trade.entryPrice ? Number(trade.entryPrice) : null;
  const exit = trade.exitPrice ? Number(trade.exitPrice) : null;
  const pnlUsd = trade.pnlUsd ? Number(trade.pnlUsd) : null;
  const amount = Number(trade.amountUsd);
  const pnlPct = pnlUsd !== null && amount > 0 ? (pnlUsd / amount) * 100 : null;

  const payload = JSON.stringify({
    asset: trade.asset,
    side: trade.side,
    size_usd: amount,
    entry,
    exit,
    pnl_usd: pnlUsd,
    pnl_pct: pnlPct,
    opened_at: trade.openedAt,
    closed_at: trade.closedAt,
  });

  try {
    const completion = await llm.chat.completions.create({
      model: MODELS.LIGHT,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: payload },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
    });
    const raw = completion.choices[0]?.message?.content;
    if (!raw) throw new Error("memory keeper returned empty response");
    const parsed = LessonsSchema.parse(JSON.parse(raw));

    await db.insert(memoryEntries).values({
      userId: trade.userId,
      tradeId: trade.id,
      outcome: parsed.outcome ?? classifyOutcome(pnlPct),
      pnlPct: pnlPct !== null ? pnlPct.toString() : null,
      lessons: parsed.lessons,
    });
  } catch (err) {
    console.error("[memory] recordTradeMemory failed for trade", trade.id, err);
  }
}

/**
 * Most recent lessons for a user, newest first. Returned as flat strings
 * so callers can drop them straight into a prompt. Empty array when no
 * memory has been recorded yet.
 */
export async function getRecentLessons(userId: string, limit = 8): Promise<string[]> {
  const rows = await db
    .select({ lessons: memoryEntries.lessons })
    .from(memoryEntries)
    .where(eq(memoryEntries.userId, userId))
    .orderBy(desc(memoryEntries.createdAt))
    .limit(limit);
  return rows.flatMap((r) => r.lessons ?? []);
}
