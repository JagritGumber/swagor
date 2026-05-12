import rosterJson from "@/lib/personas/roster.json";

export type Persona = {
  id: string;
  name: string;
  system_prompt: string;
  risk_tolerance: string;
  time_horizon: string;
  signature_concerns: string[];
  preferred_model: string;
};

export const PERSONAS: Persona[] = (rosterJson as { personas: Persona[] }).personas;

/**
 * Sample N personas from the roster. If N exceeds the roster size,
 * sample with replacement (some personas appear multiple times).
 * Always shuffles for diversity.
 */
export function samplePersonas(n: number): Persona[] {
  const shuffled = [...PERSONAS].sort(() => Math.random() - 0.5);
  if (n <= shuffled.length) return shuffled.slice(0, n);
  const result = [...shuffled];
  for (let i = shuffled.length; i < n; i++) {
    result.push(shuffled[Math.floor(Math.random() * shuffled.length)]);
  }
  return result;
}
