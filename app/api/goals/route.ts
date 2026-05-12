import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";
import {
  findOrCreatePortfolioForWallet,
  saveGoal,
} from "@/app/services/portfolio.service";
import { llm, MODELS } from "@/lib/llm-client";

const PARSER_SYSTEM_PROMPT = `You parse free-text portfolio goals for an AI-managed DeFi yield agent.

The agent manages USDC across these protocols: Aave v3, Compound v3, Pendle (PT/YT), MakerDAO DSR (sUSDS), and USYC (Circle's tokenized money-market fund). Realistic APY range is 4-15%. Anything above ~25% in DeFi yield is either a short-term incentive subsidy, a leveraged strategy, or a scam.

Given a user's free-text goal, output JSON exactly matching this shape:

{
  "feasible": true | false,
  "parsed": null | {
    "target_apy_pct": number | null,
    "max_drawdown_pct": number | null,
    "time_horizon_days": number | null,
    "risk_tolerance": "low" | "medium" | "high" | "unspecified",
    "constraints": string[],
    "strategy_preference": string | null
  },
  "feedback": "one-paragraph explanation in plain language"
}

If feasible: fill "parsed" with extracted/inferred values (use null where the user didn't specify). "feedback" explains what you understood + a realistic expectation note.

If infeasible (target >25% APY guaranteed, sub-week time horizon for double-digit returns, contradictory constraints, asking for impossible things): set "feasible": false, "parsed": null, and "feedback" should explain what's wrong + suggest a realistic alternative target.`;

const GoalParseSchema = z.object({
  feasible: z.boolean(),
  parsed: z
    .object({
      target_apy_pct: z.number().nullable(),
      max_drawdown_pct: z.number().nullable(),
      time_horizon_days: z.number().nullable(),
      risk_tolerance: z.enum(["low", "medium", "high", "unspecified"]),
      constraints: z.array(z.string()),
      strategy_preference: z.string().nullable(),
    })
    .nullable(),
  feedback: z.string(),
});

export async function POST(request: Request) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as {
    walletAddress?: string;
    goalText?: string;
  };
  const walletAddress = body.walletAddress?.toLowerCase();
  const goalText = body.goalText?.trim();

  if (!walletAddress || !/^0x[a-f0-9]{40}$/.test(walletAddress)) {
    return NextResponse.json({ error: "walletAddress required" }, { status: 400 });
  }
  if (!goalText || goalText.length < 5) {
    return NextResponse.json({ error: "goalText required (min 5 chars)" }, { status: 400 });
  }

  const completion = await llm.chat.completions.create({
    model: MODELS.HEAVY,
    messages: [
      { role: "system", content: PARSER_SYSTEM_PROMPT },
      { role: "user", content: goalText },
    ],
    response_format: { type: "json_object" },
    temperature: 0.2,
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) {
    return NextResponse.json({ error: "Parser returned no content" }, { status: 502 });
  }

  let validated: z.infer<typeof GoalParseSchema>;
  try {
    validated = GoalParseSchema.parse(JSON.parse(raw));
  } catch (e) {
    return NextResponse.json(
      { error: "Parser returned malformed output", raw: raw.slice(0, 300) },
      { status: 502 },
    );
  }

  if (validated.feasible && validated.parsed) {
    const portfolio = await findOrCreatePortfolioForWallet(user.id, walletAddress, "paper");
    await saveGoal(portfolio.id, goalText, validated.parsed);
  }

  return NextResponse.json(validated);
}
