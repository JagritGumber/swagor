import { MarketChartShell } from "./market-chart-shell";

export function MarketChartCard({ watching, admin = false }: { watching: string[]; admin?: boolean }) {
  const list = watching.length > 0 ? watching : ["ETH", "BTC", "SOL"];
  // No outer padding: header + chart + hint each manage their own
  // padding so the chart can stretch edge-to-edge inside the card.
  return (
    <section className="flex h-full flex-col overflow-hidden border border-[var(--hairline-strong)] bg-black">
      <MarketChartShell watching={list} admin={admin} />
    </section>
  );
}
