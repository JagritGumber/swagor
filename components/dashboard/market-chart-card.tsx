import { MarketChartShell } from "./market-chart-shell";

export function MarketChartCard({ watching }: { watching: string[] }) {
  const list = watching.length > 0 ? watching : ["ETH", "BTC", "SOL"];
  return (
    <section className="border border-[var(--hairline-strong)] bg-black p-6">
      <h2 className="text-2xl font-bold uppercase leading-tight text-foreground">
        Market
      </h2>
      <div className="mt-4">
        <MarketChartShell watching={list} />
      </div>
    </section>
  );
}
