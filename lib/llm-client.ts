import OpenAI from "openai";

const apiKey = process.env.GROQ_API_KEY;

if (!apiKey) {
  throw new Error("GROQ_API_KEY environment variable is not set");
}

/**
 * Groq client using the OpenAI SDK with a baseURL swap.
 * Groq is OpenAI-compatible, so the same SDK shapes (chat.completions, structured
 * outputs, function calling) all work. Fallback (drop-in): swap baseURL to
 * Together.ai or Fireworks AI.
 */
export const llm = new OpenAI({
  apiKey,
  baseURL: "https://api.groq.com/openai/v1",
  maxRetries: 3,
  timeout: 60_000,
});

/**
 * Model tiers used across the system.
 * HEAVY  = Llama 3.3 70B Versatile — Graph Builder, TaxOptimizer, Critic,
 *          and the few personas that need deeper reasoning.
 * LIGHT  = Llama 3.1 8B Instant — most swarm members (fast + cheap).
 */
export const MODELS = {
  HEAVY: "llama-3.3-70b-versatile",
  LIGHT: "llama-3.1-8b-instant",
} as const;

export type ModelTier = keyof typeof MODELS;
