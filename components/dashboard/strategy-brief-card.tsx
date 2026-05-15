/**
 * Persistent dashboard card showing the user's strategy text and current
 * watchlist. Serves as the "inputs" panel: what Selbo is reasoning over,
 * separate from the "outputs" panel (RiskStatusCard / WatchingStrip).
 *
 * Server-rendered; strategy and watchlist change rarely so polling would
 * be wasted invocations. Passed in as props from the dashboard page.
 */
export function StrategyBriefCard({
  strategy,
  watching,
}: {
  strategy: string;
  watching: string[];
}) {
  return (
    <section className="border border-[var(--hairline-strong)] bg-black p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          What Selbo is following
        </div>
        <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
          {watching.length > 0
            ? `Watching ${watching.join(", ")}`
            : "No watchlist yet"}
        </div>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-foreground">
        {strategy}
      </p>
    </section>
  );
}
