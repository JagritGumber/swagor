/**
 * Reasoning models (DeepSeek-R1, GLM-Z1, etc.) emit `<think>...</think>`
 * blocks BEFORE their actual answer. `response_format: { type: "json_object" }`
 * is honored inconsistently across providers, so JSON.parse on the raw response
 * chokes on the leading `<think>` text. Some providers also wrap output in
 * ```json fenced blocks. Both patterns surface as Zod parse failures
 * (e.g. "Agent X returned invalid JSON: <think>...").
 *
 * This helper:
 *   1. Strips every `<think>...</think>` block (including unclosed ones).
 *   2. Strips ```json ... ``` fences if present.
 *   3. Returns the substring from the first `{` to the matching last `}`.
 *
 * Throws if no `{...}` object can be located.
 */
export function extractJson(raw: string): string {
  // 1. Strip <think>...</think> blocks. Greedy across newlines.
  let cleaned = raw.replace(/<think>[\s\S]*?<\/think>/gi, "");
  // Also handle the unclosed-think case where the model stopped mid-thought.
  cleaned = cleaned.replace(/<think>[\s\S]*$/i, "");
  // 2. Strip ```json ... ``` or generic ``` fences.
  cleaned = cleaned.replace(/```(?:json)?\s*/gi, "").replace(/```/g, "");
  // 3. Find the outermost JSON object.
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error(`extractJson: no JSON object found in response (length=${raw.length}, preview="${raw.slice(0, 120)}")`);
  }
  return cleaned.substring(start, end + 1);
}
