"use client";

import { useEffect, useState } from "react";

export function GoalForm({
  walletAddress,
  initialStrategy,
}: {
  walletAddress: string;
  initialStrategy: string;
}) {
  const [goalText, setGoalText] = useState(initialStrategy);
  const [submitting, setSubmitting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!saved) return;
    const id = setTimeout(() => setSaved(false), 2500);
    return () => clearTimeout(id);
  }, [saved]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    setSaved(false);
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
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save strategy");
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
        <div className="flex items-center gap-4">
          <button
            type="submit"
            disabled={submitting || goalText.length < 5 || goalText === initialStrategy}
            className="cta-glow inline-flex h-10 items-center justify-center border border-[var(--neon-cyan)] bg-[var(--neon-cyan)] px-5 font-mono text-xs font-bold uppercase tracking-[0.18em] text-black hover:bg-black hover:text-[var(--neon-cyan)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "Saving..." : "Save strategy"}
          </button>
          {saved && (
            <span className="font-mono text-xs uppercase tracking-[0.18em] text-[var(--neon-green)]">
              Saved
            </span>
          )}
          {error && (
            <span className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--neon-red)]">
              {error}
            </span>
          )}
        </div>
      </form>
    </section>
  );
}
