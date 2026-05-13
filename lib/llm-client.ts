import OpenAI from "openai";

/**
 * Three LLM tiers, each fully explicit in env. No string defaults, no
 * fallback chains; missing required env throws at module-load.
 *
 *   Main (swarm + heavy):
 *     LLM_API_KEY, LLM_BASE_URL, LLM_MODEL_HEAVY, LLM_MODEL_LIGHT
 *
 *   Review (critic + tax-optimizer, optionally cross-vendor):
 *     LLM_REVIEW_MODEL                     (required)
 *     LLM_REVIEW_API_KEY + LLM_REVIEW_BASE_URL  (optional pair; if both set,
 *                                                a separate client is built;
 *                                                else `reviewLlm === llm`)
 *
 *   Watcher (cheap-tier ticker, optionally cross-vendor for high RPM):
 *     LLM_WATCHER_MODEL                    (required)
 *     LLM_WATCHER_API_KEY + LLM_WATCHER_BASE_URL  (optional pair; same rules)
 */

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env: ${name}`);
  return v;
}

function optionalPair(keyName: string, urlName: string): { apiKey: string; baseURL: string } | null {
  const apiKey = process.env[keyName];
  const baseURL = process.env[urlName];
  if (!apiKey && !baseURL) return null;
  if (!apiKey || !baseURL) {
    throw new Error(`${keyName} and ${urlName} must be set together (or neither)`);
  }
  return { apiKey, baseURL };
}

export const llm = new OpenAI({
  apiKey: requireEnv("LLM_API_KEY"),
  baseURL: requireEnv("LLM_BASE_URL"),
  maxRetries: 3,
  timeout: 60_000,
});

const reviewPair = optionalPair("LLM_REVIEW_API_KEY", "LLM_REVIEW_BASE_URL");
export const reviewLlm = reviewPair
  ? new OpenAI({ ...reviewPair, maxRetries: 3, timeout: 120_000 })
  : llm;

const watcherPair = optionalPair("LLM_WATCHER_API_KEY", "LLM_WATCHER_BASE_URL");
export const watcherLlm = watcherPair
  ? new OpenAI({ ...watcherPair, maxRetries: 2, timeout: 30_000 })
  : llm;

export const MODELS = {
  HEAVY: requireEnv("LLM_MODEL_HEAVY"),
  LIGHT: requireEnv("LLM_MODEL_LIGHT"),
  REVIEW: requireEnv("LLM_REVIEW_MODEL"),
  WATCHER: requireEnv("LLM_WATCHER_MODEL"),
} as const;

export type ModelTier = keyof typeof MODELS;
