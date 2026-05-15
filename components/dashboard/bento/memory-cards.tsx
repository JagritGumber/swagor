"use client";

import { useEffect, useState } from "react";
import { ThumbsUp, ThumbsDown, Trash2 } from "lucide-react";

type Memory = {
  id: string;
  lessons: string[] | null;
  outcome: string;
  pnlPct: string | null;
  userFeedback: "good" | "bad" | null;
  createdAt: string;
  tradeId: string | null;
  tradeAsset: string | null;
  tradeSide: string | null;
};

const OUTCOME_TONE: Record<string, string> = {
  win: "text-[var(--neon-green)]",
  loss: "text-[var(--neon-red)]",
  breakeven: "text-muted-foreground",
};

function agoString(ts: string): string {
  const s = Math.max(0, Math.floor((Date.now() - new Date(ts).getTime()) / 1000));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86_400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86_400)}d`;
}

/**
 * Memory cards. Each row is one trade's lessons with thumbs up/down and
 * delete buttons. Bad-rated and deleted entries are excluded from future
 * agent context reads (`getRecentLessons`). Optimistic updates so the
 * thumbs-down feedback feels immediate.
 */
export function MemoryCards() {
  const [memories, setMemories] = useState<Memory[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    try {
      const res = await fetch("/api/memory", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { memories: Memory[] };
      setMemories(data.memories);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const setFeedback = async (id: string, fb: "good" | "bad" | null) => {
    setMemories((prev) =>
      prev ? prev.map((m) => (m.id === id ? { ...m, userFeedback: fb } : m)) : prev,
    );
    try {
      await fetch(`/api/memory/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userFeedback: fb }),
      });
    } catch {
      void refresh();
    }
  };

  const remove = async (id: string) => {
    setMemories((prev) => prev ? prev.filter((m) => m.id !== id) : prev);
    try {
      await fetch(`/api/memory/${id}`, { method: "DELETE" });
    } catch {
      void refresh();
    }
  };

  if (error) return <p className="text-xs text-[var(--neon-red)]">memory: {error}</p>;
  if (memories === null) return <p className="text-xs text-muted-foreground">Loading...</p>;
  if (memories.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No lessons recorded yet. Selbo writes a memory entry when a trade closes.
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {memories.map((m) => {
        const pnlPct = m.pnlPct ? Number(m.pnlPct) : null;
        const isBad = m.userFeedback === "bad";
        return (
          <li
            key={m.id}
            className={`border ${isBad ? "border-[var(--neon-red)]/40 opacity-60" : "border-[var(--hairline)]"} bg-[#0a0a0a] p-3`}
          >
            <header className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 font-mono text-[11px] uppercase tracking-[0.14em]">
              <span className="flex items-baseline gap-3">
                {m.tradeAsset && (
                  <span className="font-bold text-foreground">
                    {m.tradeSide?.toUpperCase()} {m.tradeAsset}
                  </span>
                )}
                <span className={OUTCOME_TONE[m.outcome] ?? "text-muted-foreground"}>
                  {m.outcome}
                </span>
                {pnlPct !== null && (
                  <span className={pnlPct >= 0 ? "text-[var(--neon-green)] tabular-nums" : "text-[var(--neon-red)] tabular-nums"}>
                    {pnlPct >= 0 ? "+" : ""}{pnlPct.toFixed(2)}%
                  </span>
                )}
              </span>
              <span className="text-muted-foreground">{agoString(m.createdAt)} ago</span>
            </header>
            {m.lessons && m.lessons.length > 0 && (
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-foreground">
                {m.lessons.map((l, i) => (
                  <li key={i}>{l}</li>
                ))}
              </ul>
            )}
            <div className="mt-3 flex items-center gap-2 font-mono text-[10px]">
              <button
                type="button"
                onClick={() => setFeedback(m.id, m.userFeedback === "good" ? null : "good")}
                aria-label="Thumbs up"
                title="Good lesson; keep using it"
                className={`flex items-center gap-1 border px-2 py-1 ${m.userFeedback === "good" ? "border-[var(--neon-green)] text-[var(--neon-green)]" : "border-[var(--hairline)] text-muted-foreground hover:text-foreground"}`}
              >
                <ThumbsUp aria-hidden className="h-3 w-3" />
                <span className="uppercase tracking-[0.14em]">keep</span>
              </button>
              <button
                type="button"
                onClick={() => setFeedback(m.id, isBad ? null : "bad")}
                aria-label="Thumbs down"
                title="Bad lesson; stop citing it"
                className={`flex items-center gap-1 border px-2 py-1 ${isBad ? "border-[var(--neon-red)] text-[var(--neon-red)]" : "border-[var(--hairline)] text-muted-foreground hover:text-foreground"}`}
              >
                <ThumbsDown aria-hidden className="h-3 w-3" />
                <span className="uppercase tracking-[0.14em]">drop</span>
              </button>
              <button
                type="button"
                onClick={() => remove(m.id)}
                aria-label="Delete"
                title="Remove this entry"
                className="ml-auto flex items-center gap-1 border border-[var(--hairline)] px-2 py-1 text-muted-foreground hover:border-[var(--neon-red)] hover:text-[var(--neon-red)]"
              >
                <Trash2 aria-hidden className="h-3 w-3" />
                <span className="uppercase tracking-[0.14em]">delete</span>
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
