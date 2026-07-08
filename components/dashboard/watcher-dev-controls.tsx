"use client";

import { useState } from "react";

/**
 * Dev-only watcher control buttons. Force tick runs the watcher for the
 * current user bypassing the cron cadence check; force escalate skips the
 * watcher entirely and creates a cycle directly. Both useful for testing
 * the panel locally where the cron is not firing.
 */
export function WatcherDevControls() {
  const [busy, setBusy] = useState<"tick" | "escalate" | "judgment" | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  async function hit(path: string, key: "tick" | "escalate" | "judgment") {
    if (busy) return;
    setBusy(key);
    setLastError(null);
    try {
      const res = await fetch(path, { method: "POST" });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || body.ok === false) {
        setLastError(body.error ?? `HTTP ${res.status}`);
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="border border-[var(--neon-cyan)]/40 bg-black p-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <span className="font-mono text-xs font-bold uppercase tracking-[0.18em] text-[var(--neon-cyan)]">
          dev controls
        </span>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => hit("/api/watcher/force-tick", "tick")}
            disabled={!!busy}
            className="inline-flex h-9 items-center justify-center border border-[var(--hairline-strong)] bg-black px-4 font-mono text-xs font-bold uppercase tracking-[0.18em] text-foreground transition hover:border-[var(--neon-cyan)] hover:text-[var(--neon-cyan)] disabled:opacity-50"
          >
            {busy === "tick" ? "Ticking..." : "Force tick"}
          </button>
          <button
            type="button"
            onClick={() => hit("/api/watcher/force-escalate", "escalate")}
            disabled={!!busy}
            className="inline-flex h-9 items-center justify-center border border-[var(--neon-cyan)] bg-[var(--neon-cyan)] px-4 font-mono text-xs font-bold uppercase tracking-[0.18em] text-black hover:bg-black hover:text-[var(--neon-cyan)] disabled:opacity-50"
          >
            {busy === "escalate" ? "Firing..." : "Force escalate"}
          </button>
          <button
            type="button"
            onClick={() => hit("/api/judgment/force-tick", "judgment")}
            disabled={!!busy}
            className="inline-flex h-9 items-center justify-center border border-[var(--hairline-strong)] bg-black px-4 font-mono text-xs font-bold uppercase tracking-[0.18em] text-foreground transition hover:border-[var(--neon-cyan)] hover:text-[var(--neon-cyan)] disabled:opacity-50"
          >
            {busy === "judgment" ? "Judging..." : "Force judgment"}
          </button>
        </div>
      </div>
      {lastError && (
        <p className="mt-3 font-mono text-xs uppercase tracking-[0.16em] text-[var(--neon-red)]">
          {lastError}
        </p>
      )}
    </section>
  );
}
