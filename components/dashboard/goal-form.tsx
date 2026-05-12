"use client";

import { useState } from "react";

type ParseResult = { feasible: boolean; feedback: string };

export function GoalForm({ walletAddress }: { walletAddress: string }) {
  const [goalText, setGoalText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ParseResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress, goalText }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const data = await res.json();
      setResult({ feasible: !!data.feasible, feedback: data.feedback ?? "" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to parse goal");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="border border-[var(--hairline-strong)] bg-black p-6">
      <h2 className="text-2xl font-bold uppercase leading-tight text-foreground">
        Strategy
      </h2>
      <form onSubmit={submit} className="mt-4 space-y-4">
        <textarea
          value={goalText}
          onChange={(e) => setGoalText(e.target.value)}
          rows={4}
          placeholder="e.g. moderate risk, 8 to 15 percent conviction trades, never leverage, exit anything red after 72 hours"
          className="w-full border border-[var(--hairline-strong)] bg-[#080808] px-3 py-3 font-mono text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-[var(--neon-cyan)] focus:outline-none"
        />
        <button
          type="submit"
          disabled={submitting || goalText.length < 5}
          className="cta-glow inline-flex h-10 items-center justify-center border border-[var(--neon-cyan)] bg-[var(--neon-cyan)] px-5 font-mono text-xs font-bold uppercase tracking-[0.18em] text-black hover:bg-black hover:text-[var(--neon-cyan)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? "Parsing..." : "Set strategy"}
        </button>
      </form>
      {error && <p className="mt-4 font-mono text-xs uppercase tracking-[0.16em] text-[var(--neon-red)]">{error}</p>}
      {result && (
        <div className={`mt-6 border p-4 ${result.feasible ? "border-[var(--neon-green)]/40 bg-[var(--neon-green)]/5" : "border-[var(--neon-amber,#ffae00)]/40 bg-[var(--neon-amber,#ffae00)]/5"}`}>
          <div className={`font-mono text-xs font-bold uppercase tracking-[0.18em] ${result.feasible ? "text-[var(--neon-green)]" : "text-[var(--neon-amber,#ffae00)]"}`}>
            {result.feasible ? "Strategy accepted" : "Needs adjustment"}
          </div>
          <p className="mt-2 text-sm text-muted-foreground">{result.feedback}</p>
        </div>
      )}
    </section>
  );
}
