import OpenAI from "openai";

/**
 * Provider-pluggable LLM client with two tiers:
 *  - main `llm` (LIGHT + HEAVY): swarm members + heavy reasoning
 *  - `reviewLlm` (REVIEW): cross-lineage audit layer (TaxOptimizer + Critic)
 *
 * Cross-model REVIEW: same-family self-review has correlated blind spots
 * (a GLM Critic reviewing GLM swarm output is mostly theater). Configure
 * LLM_REVIEW_* to a different model family (e.g. DeepSeek R1 via DeepInfra)
 * to get genuine independent verification.
 *
 * Env vars:
 *   LLM_API_KEY        (required)
 *   LLM_BASE_URL       (default GLM: https://open.bigmodel.cn/api/paas/v4/)
 *   LLM_MODEL_HEAVY    (default glm-4-plus)
 *   LLM_MODEL_LIGHT    (default glm-4-flash)
 *   LLM_REVIEW_API_KEY (optional — falls back to LLM_API_KEY)
 *   LLM_REVIEW_BASE_URL(optional — falls back to LLM_BASE_URL)
 *   LLM_REVIEW_MODEL   (optional — falls back to LLM_MODEL_HEAVY)
 */

const apiKey = process.env.LLM_API_KEY;
if (!apiKey) {
  throw new Error("LLM_API_KEY environment variable is not set");
}

export const llm = new OpenAI({
  apiKey,
  baseURL: process.env.LLM_BASE_URL ?? "https://open.bigmodel.cn/api/paas/v4/",
  maxRetries: 3,
  timeout: 60_000,
});

const reviewApiKey = process.env.LLM_REVIEW_API_KEY;
const reviewBaseUrl = process.env.LLM_REVIEW_BASE_URL;

export const reviewLlm =
  reviewApiKey && reviewBaseUrl
    ? new OpenAI({
        apiKey: reviewApiKey,
        baseURL: reviewBaseUrl,
        maxRetries: 3,
        timeout: 120_000,
      })
    : llm;

export const MODELS = {
  HEAVY: process.env.LLM_MODEL_HEAVY ?? "glm-4-plus",
  LIGHT: process.env.LLM_MODEL_LIGHT ?? "glm-4-flash",
  REVIEW:
    process.env.LLM_REVIEW_MODEL ??
    process.env.LLM_MODEL_HEAVY ??
    "glm-4-plus",
} as const;

export type ModelTier = keyof typeof MODELS;

export function getClient(tier: ModelTier): OpenAI {
  return tier === "REVIEW" ? reviewLlm : llm;
}
