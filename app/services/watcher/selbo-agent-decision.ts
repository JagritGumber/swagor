import { getClient, MODELS } from "@/lib/llm-client";
import { AGENT_SYSTEM_PROMPT, AGENT_OUTPUT_SCHEMA, type AgentOutput } from "./agent-prompt";
import { buildAgentPayload } from "./agent-payload";
import type { SelboTickInput, WatcherDecision, CadenceDecision } from "./selbo-tick-types";

function cadence(nextCheckSeconds: number, hasPosition: boolean): CadenceDecision {
  return {
    nextCheckSeconds,
    state: hasPosition ? "position_protection" : "normal_scan",
    reason: "agent-chosen cadence",
  };
}

function hold(reason: string, nextCheckSeconds: number, hasPosition: boolean): WatcherDecision {
  return {
    action: "hold", asset: null, reason, marketTrigger: "none", externalPressure: "unknown",
    confidence: 0, cadence: cadence(nextCheckSeconds, hasPosition), sizeUsd: 0, leverage: 1,
    stopLossPriceUsd: null, takeProfitPriceUsd: null, blockedReasons: [],
  };
}

function toDecision(out: AgentOutput, hasPosition: boolean): WatcherDecision {
  // No-blowup discipline lives in the executor/risk engine, not here, but an
  // open with no risk levels is incoherent -> treat as hold.
  if ((out.action === "open_long" || out.action === "open_short") && (out.stopLossPriceUsd === null || out.takeProfitPriceUsd === null)) {
    return hold(`agent wanted ${out.action} on ${out.asset ?? "?"} but gave no stop/target`, out.nextCheckSeconds, hasPosition);
  }
  return {
    action: out.action, asset: out.asset, reason: out.reason, marketTrigger: "none",
    externalPressure: "unknown", confidence: out.confidence, cadence: cadence(out.nextCheckSeconds, hasPosition),
    sizeUsd: out.sizeUsd, leverage: out.leverage, stopLossPriceUsd: out.stopLossPriceUsd,
    takeProfitPriceUsd: out.takeProfitPriceUsd, blockedReasons: [],
  };
}

/**
 * The agent decides the trade. Same function live and in backtest. The only
 * deterministic step is a hard no-blowup guard: if the risk engine flags
 * urgent/critical on an open position, close it without consulting the LLM.
 * Everything else - direction, size, leverage, stops, hold - is the agent's.
 */
export async function decideSelboTick(input: SelboTickInput): Promise<WatcherDecision> {
  const open = input.positions.find((p) => p.side === "long" || p.side === "short");
  if ((input.risk.status === "critical" || input.risk.status === "urgent") && open) {
    return {
      action: "risk_emergency", asset: open.asset, reason: input.risk.summary || "risk engine: protect the position",
      marketTrigger: "risk_exit", externalPressure: "unknown", confidence: 1,
      cadence: cadence(120, true), sizeUsd: 0, leverage: 1,
      stopLossPriceUsd: null, takeProfitPriceUsd: null, blockedReasons: [],
    };
  }

  try {
    const res = await getClient("TRADER").chat.completions.create({
      model: MODELS.TRADER,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: AGENT_SYSTEM_PROMPT },
        { role: "user", content: buildAgentPayload(input) },
      ],
    });
    const raw = res.choices[0]?.message?.content ?? "";
    const parsed = AGENT_OUTPUT_SCHEMA.safeParse(JSON.parse(raw));
    if (!parsed.success) return hold("agent output failed validation; holding", 600, Boolean(open));
    return toDecision(parsed.data, Boolean(open));
  } catch (err) {
    console.error("[agent-decision] failed:", err);
    return hold("agent call failed; holding", 600, Boolean(open));
  }
}
