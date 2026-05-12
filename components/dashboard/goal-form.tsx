"use client";

import { useAccount } from "wagmi";
import { useState } from "react";

type ParseResult = {
  feasible: boolean;
  parsed: {
    target_apy_pct: number | null;
    max_drawdown_pct: number | null;
    time_horizon_days: number | null;
    risk_tolerance: "low" | "medium" | "high" | "unspecified";
    constraints: string[];
    strategy_preference: string | null;
  } | null;
  feedback: string;
};

export function GoalForm() {
  const { address, isConnected } = useAccount();
  const [goalText, setGoalText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ParseResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!address || submitting) return;
    setSubmitting(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress: address, goalText }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      setResult(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to parse goal");
    } finally {
      setSubmitting(false);
    }
  }

  if (!isConnected) {
    return (
      <div className="rounded-lg border p-6">
        <h2 className="text-lg font-semibold mb-2">Your goal</h2>
        <p className="text-sm text-muted-foreground">Connect a wallet first.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border p-6 space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Your goal</h2>
        <p className="text-sm text-muted-foreground">
          Describe in plain English what you want the agent to optimize for.
          Example: &quot;10% APY with low drawdown, hold positions at least 90 days.&quot;
        </p>
      </div>
      <form onSubmit={submit} className="space-y-3">
        <textarea
          value={goalText}
          onChange={(e) => setGoalText(e.target.value)}
          rows={3}
          placeholder="e.g. 8% APY with low risk, OK to lock for 3 months"
          className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-foreground/50"
        />
        <button
          type="submit"
          disabled={submitting || goalText.length < 5}
          className="px-4 py-2 bg-foreground text-background rounded-md text-sm font-medium hover:opacity-90 disabled:opacity-50"
        >
          {submitting ? "Parsing..." : "Set goal"}
        </button>
      </form>
      {error && <p className="text-sm text-red-500">{error}</p>}
      {result && (
        <div
          className={`rounded-md p-3 text-sm ${result.feasible ? "bg-green-500/10 border border-green-500/30" : "bg-yellow-500/10 border border-yellow-500/30"}`}
        >
          <p className="font-medium mb-1">
            {result.feasible ? "Goal accepted" : "Goal needs adjustment"}
          </p>
          <p className="text-muted-foreground">{result.feedback}</p>
          {result.parsed && (
            <pre className="mt-2 text-xs bg-background/50 p-2 rounded overflow-x-auto">
              {JSON.stringify(result.parsed, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
