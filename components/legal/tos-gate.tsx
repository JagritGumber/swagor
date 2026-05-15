"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

/**
 * Full-screen ToS gate. Rendered by the dashboard page when
 * `selboInstances.tosAcceptedAt` is null. Acceptance posts to
 * /api/selbo/accept-tos and refreshes the page so the dashboard
 * unlocks. Read-the-disclaimer link opens in a new tab.
 */
export function TosGate() {
  const router = useRouter();
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onAccept = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/selbo/accept-tos", { method: "POST" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to record acceptance");
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 px-4">
      <div className="w-full max-w-lg border border-[var(--hairline-strong)] bg-black p-6 shadow-xl">
        <h2 className="text-2xl font-bold uppercase leading-tight text-foreground">
          Before you continue
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-foreground">
          Selbo is a paper-mode AI experiment on Hyperliquid testnet. No real
          funds are placed at risk. Numbers, positions, and PnL are simulated.
          Selbo&apos;s output is not financial advice and not a recommendation.
          If you act on what you see here with real capital elsewhere, you do
          so at your own risk.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-foreground">
          Read the full{" "}
          <Link
            href="/legal/disclaimer"
            target="_blank"
            rel="noreferrer"
            className="text-[var(--neon-cyan)] underline-offset-4 hover:underline"
          >
            disclaimer
          </Link>
          .
        </p>

        <label className="mt-5 flex cursor-pointer items-start gap-3 text-sm text-foreground">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-1 h-4 w-4 accent-[var(--neon-cyan)]"
          />
          <span>
            I have read and agree to the Selbo disclaimer. I understand this is
            paper-mode and not financial advice.
          </span>
        </label>

        {error && (
          <p className="mt-3 font-mono text-xs text-[var(--neon-red)]">{error}</p>
        )}

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onAccept}
            disabled={!agreed || submitting}
            className="border border-[var(--neon-cyan)] bg-[var(--neon-cyan)]/10 px-4 py-2 font-mono text-xs uppercase tracking-[0.16em] text-[var(--neon-cyan)] hover:bg-[var(--neon-cyan)]/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "Recording..." : "Accept and continue"}
          </button>
        </div>
      </div>
    </div>
  );
}
