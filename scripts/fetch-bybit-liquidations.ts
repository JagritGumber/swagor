const BASE_URL = "https://api.bybit.com";

type Liquidation = {
  time: number;
  symbol: string;
  side: "Buy" | "Sell";
  size: number;
  price: number;
  isLiquidation: boolean;
};

async function fetchRecentTrades(symbol: string, limit: number = 1000): Promise<Liquidation[]> {
  const url = `${BASE_URL}/v5/market/recent-trade?symbol=${symbol}&category=linear&limit=${limit}`;
  const response = await fetch(url);
  const data = await response.json() as any;

  if (data.retCode !== 0) {
    throw new Error(`Bybit API error: ${data.retMsg}`);
  }

  return data.result.list
    .filter((trade: any) => trade.isBlockTrade === false)
    .map((trade: any) => ({
      time: Number(trade.time),
      symbol: trade.symbol,
      side: trade.side as "Buy" | "Sell",
      size: Number(trade.size),
      price: Number(trade.price),
      isLiquidation: trade.isLiquidation ?? false,
    }));
}

async function fetchLiquidationStream(symbol: string, durationMs: number = 60_000): Promise<Liquidation[]> {
  const liquidations: Liquidation[] = [];
  const start = Date.now();
  let lastTime = 0;

  console.log(`Fetching liquidations for ${symbol} over ${durationMs / 1000}s...`);

  while (Date.now() - start < durationMs) {
    try {
      const trades = await fetchRecentTrades(symbol, 1000);
      const newLiquidations = trades.filter(
        (t) => t.isLiquidation && t.time > lastTime
      );

      if (newLiquidations.length > 0) {
        liquidations.push(...newLiquidations);
        lastTime = Math.max(...newLiquidations.map((l) => l.time));
        console.log(`  Found ${newLiquidations.length} liquidations (total: ${liquidations.length})`);
      }

      await new Promise((r) => setTimeout(r, 1000));
    } catch (e) {
      console.error(`  Error: ${e}`);
      await new Promise((r) => setTimeout(r, 5000));
    }
  }

  return liquidations;
}

function analyzeLiquidations(liquidations: Liquidation[]): void {
  if (liquidations.length === 0) {
    console.log("No liquidations found");
    return;
  }

  const bySide = {
    Buy: liquidations.filter((l) => l.side === "Buy"),
    Sell: liquidations.filter((l) => l.side === "Sell"),
  };

  const totalSize = liquidations.reduce((s, l) => s + l.size, 0);
  const avgSize = totalSize / liquidations.length;

  const prices = liquidations.map((l) => l.price);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);

  console.log("\n=== Liquidation Analysis ===");
  console.log(`Total: ${liquidations.length} liquidations`);
  console.log(`Total size: ${totalSize.toFixed(2)} contracts`);
  console.log(`Avg size: ${avgSize.toFixed(2)} contracts`);
  console.log(`Price range: ${minPrice.toFixed(2)} - ${maxPrice.toFixed(2)}`);
  console.log(`Long liquidations (Buy): ${bySide.Buy.length} (${(bySide.Buy.length / liquidations.length * 100).toFixed(1)}%)`);
  console.log(`Short liquidations (Sell): ${bySide.Sell.length} (${(bySide.Sell.length / liquidations.length * 100).toFixed(1)}%)`);

  // Size distribution
  const sizeBuckets = [
    { label: "< 100", max: 100 },
    { label: "100-500", max: 500 },
    { label: "500-1000", max: 1000 },
    { label: "1000-5000", max: 5000 },
    { label: "> 5000", max: Infinity },
  ];

  console.log("\nSize distribution:");
  for (const bucket of sizeBuckets) {
    const count = liquidations.filter((l) => {
      const prev = sizeBuckets.indexOf(bucket) > 0 ? sizeBuckets[sizeBuckets.indexOf(bucket) - 1].max : 0;
      return l.size >= prev && l.size < bucket.max;
    }).length;
    console.log(`  ${bucket.label.padEnd(10)} ${count} (${(count / liquidations.length * 100).toFixed(1)}%)`);
  }

  // Price clusters
  console.log("\nTop 10 price levels by size:");
  const byPrice = new Map<number, number>();
  for (const l of liquidations) {
    const rounded = Math.round(l.price / 10) * 10;
    byPrice.set(rounded, (byPrice.get(rounded) ?? 0) + l.size);
  }
  const sorted = [...byPrice.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  for (const [price, size] of sorted) {
    console.log(`  $${price.toFixed(0)}: ${size.toFixed(2)} contracts`);
  }
}

async function main() {
  const symbol = process.argv[2] ?? "BTCUSDT";
  const duration = Number(process.argv[3] ?? 60) * 1000;

  const liquidations = await fetchLiquidationStream(symbol, duration);
  analyzeLiquidations(liquidations);

  // Save to file
  const filename = `.data/liquidations-${symbol}-${new Date().toISOString().slice(0, 10)}.json`;
  const fs = await import("node:fs/promises");
  await fs.mkdir(".data", { recursive: true });
  await fs.writeFile(filename, JSON.stringify(liquidations, null, 2));
  console.log(`\nSaved to ${filename}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
