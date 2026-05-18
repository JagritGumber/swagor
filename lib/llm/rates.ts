/**
 * Per-model input/output rates in USD per 1k tokens, used to compute the
 * actual `cost_usd` we stamp on every llm_calls row at log time. Source
 * URLs are pinned because vendor pages drift; refresh quarterly or when
 * we change models.
 *
 * Sources (2026-05):
 *   - DeepInfra:   https://deepinfra.com/pricing
 *   - Zhipu GLM:   https://bigmodel.cn/pricing
 *
 * `getModelRate` returns null for unmapped models (e.g., a new tier we
 * forgot to register). Callers should log a warn and store a null cost.
 */
export type ModelRate = { inputPer1k: number; outputPer1k: number };

const MODEL_RATES: Record<string, ModelRate> = {
  "glm-4.7-flashx": { inputPer1k: 0.00010, outputPer1k: 0.00030 },
  "glm-4-32b-0414-128k": { inputPer1k: 0.00010, outputPer1k: 0.00010 },
  "deepseek-ai/DeepSeek-R1": { inputPer1k: 0.00055, outputPer1k: 0.00219 },
  "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo": { inputPer1k: 0.00003, outputPer1k: 0.00005 },
  "mistralai/Mistral-Small-24B-Instruct-2501": { inputPer1k: 0.00005, outputPer1k: 0.00008 },
};

export function getModelRate(model: string): ModelRate | null {
  return MODEL_RATES[model] ?? null;
}

export function computeLlmCost(
  model: string,
  promptTokens: number | null | undefined,
  completionTokens: number | null | undefined,
): number | null {
  const rate = getModelRate(model);
  if (!rate) return null;
  const inUsd = ((promptTokens ?? 0) / 1000) * rate.inputPer1k;
  const outUsd = ((completionTokens ?? 0) / 1000) * rate.outputPer1k;
  return Number((inUsd + outUsd).toFixed(8));
}
