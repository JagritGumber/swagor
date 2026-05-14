import type { MonitorTick } from "@/lib/db/schema";

/**
 * "Why did Selbo act?" Surfaces the watcher's escalation rationale + the
 * watchlist + tick context so the user understands what the cheap-tier
 * agent saw that warranted the full panel. Renders nothing if this cycle
 * was not triggered by a watcher (legacy, manual trigger, etc.).
 */
export function TriggerSection({ tick }: { tick: MonitorTick | null }) {
  if (!tick) return null;
  const watching = Array.isArray(tick.watching) ? tick.watching : [];

  return (
    <section className="border border-[var(--hairline-strong)] bg-black p-6">
      <div className="font-mono text-xs uppercase tracking-[0.18em] text-[var(--neon-cyan)]">
        Trigger
      </div>
      <h2 className="mt-3 text-2xl font-bold uppercase leading-tight text-foreground">
        Why Selbo escalated
      </h2>
      <p className="mt-4 text-base text-foreground">
        {tick.rationale}
      </p>
      <div className="mt-6 grid grid-cols-2 gap-4 font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground sm:grid-cols-3">
        <div>
          <div className="text-[10px] tracking-[0.18em]">Watching</div>
          <div className="mt-1 text-foreground normal-case tracking-normal">
            {watching.join(", ") || "—"}
          </div>
        </div>
        <div>
          <div className="text-[10px] tracking-[0.18em]">Verdict</div>
          <div className="mt-1 text-[var(--neon-cyan)]">{tick.verdict}</div>
        </div>
        <div>
          <div className="text-[10px] tracking-[0.18em]">Seen at</div>
          <div className="mt-1 text-foreground normal-case tracking-normal">
            {new Date(tick.createdAt).toLocaleString()}
          </div>
        </div>
      </div>
    </section>
  );
}
