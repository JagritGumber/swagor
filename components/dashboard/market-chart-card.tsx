import { MarketChartShell } from "./market-chart-shell";

export function MarketChartCard({
  watching, admin = false, endpoint, interactiveMarkers, defaultInterval, defaultLookbackMs, asset, onAsset,
}: { watching: string[]; admin?: boolean; endpoint?: string; interactiveMarkers?: boolean; defaultInterval?: "1m" | "5m" | "15m" | "1h" | "4h" | "1d"; defaultLookbackMs?: number; asset?: string; onAsset?: (a: string) => void }) {
  const list = watching.length > 0 ? watching : ["ETH", "BTC", "SOL"];
  // No outer padding: header + chart + hint each manage their own
  // padding so the chart can stretch edge-to-edge inside the card.
  return (
    <section className="flex h-full flex-col overflow-hidden border border-[var(--hairline-strong)] bg-black">
      <MarketChartShell watching={list} admin={admin} endpoint={endpoint} interactiveMarkers={interactiveMarkers} defaultInterval={defaultInterval} defaultLookbackMs={defaultLookbackMs} asset={asset} onAsset={onAsset} />
    </section>
  );
}
