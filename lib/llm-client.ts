import OpenAI from "openai";

/**
 * Provider-pluggable LLM client. Uses any OpenAI-compatible endpoint:
 * GLM (default — prepaid, no surprise billing), Cerebras, Groq, Together,
 * Fireworks, etc. Swap providers by changing env vars in .env.local; no
 * code change required.
 *
 * Env vars:
 *   LLM_API_KEY        (required) — provider's API key
 *   LLM_BASE_URL       (optional) — defaults to GLM: https://open.bigmodel.cn/api/paas/v4/
 *   LLM_MODEL_HEAVY    (optional) — defaults to glm-4-plus
 *   LLM_MODEL_LIGHT    (optional) — defaults to glm-4-flash
 *
 * MODELS.HEAVY is used by reasoning-heavy agents (Graph Builder, TaxOptimizer,
 * Critic, Aggregator). MODELS.LIGHT is used by swarm members (30-50 per cycle).
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

export const MODELS = {
  HEAVY: process.env.LLM_MODEL_HEAVY ?? "glm-4-plus",
  LIGHT: process.env.LLM_MODEL_LIGHT ?? "glm-4-flash",
} as const;

export type ModelTier = keyof typeof MODELS;
