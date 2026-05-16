"use client";

import { useEffect } from "react";

const CONN_RE = /ECONNREFUSED|ETIMEDOUT|ENOTFOUND|fetch failed|getaddrinfo|connect failed|terminating connection|network|offline|EAI_AGAIN/i;

/**
 * Next.js segment error boundary for /dashboard/*. Catches any error
 * thrown during server rendering of dashboard pages -- most commonly
 * a DB query that fails because the database is unreachable (user
 * went offline, Supabase is down, etc.). Renders a friendly message
 * with a Retry button instead of a raw stack trace.
 */
export default function DashboardError({
  error, reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[dashboard error.tsx]", error);
  }, [error]);

  const isConnection = CONN_RE.test(error.message ?? "");

  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <section className="border border-[var(--hairline-strong)] bg-black px-6 py-10 text-center">
        <h1 className="text-2xl font-bold uppercase leading-tight text-foreground">
          {isConnection ? "Can't reach Selbo" : "Something went wrong"}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          {isConnection
            ? "We couldn't connect to the database. Check your internet, then click Retry."
            : "An unexpected error happened loading this page. Try again, or reload."}
        </p>
        <button
          type="button"
          onClick={() => reset()}
          className="mt-6 inline-flex items-center gap-2 border border-[var(--neon-cyan)] bg-[var(--neon-cyan)]/10 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--neon-cyan)] hover:bg-[var(--neon-cyan)]/20"
        >
          Retry
        </button>
        {error.digest && (
          <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            ref: {error.digest}
          </p>
        )}
      </section>
    </div>
  );
}
