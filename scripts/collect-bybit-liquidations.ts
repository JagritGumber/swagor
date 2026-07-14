import { writeFile, mkdir } from "node:fs/promises";

const WS_URL = "wss://stream.bybit.com/v5/public/linear";
const SYMBOL = process.argv[2] ?? "BTCUSDT";
const DURATION_MS = Number(process.argv[3] ?? 60) * 1000;

type Liquidation = {
  time: number;
  symbol: string;
  side: "Buy" | "Sell";
  size: number;
  bankruptcyPrice: number;
};

async function main() {
  console.log(`Collecting liquidations for ${SYMBOL} over ${DURATION_MS / 1000}s...`);

  const liquidations: Liquidation[] = [];
  const start = Date.now();

  const ws = new WebSocket(WS_URL);

  ws.onopen = () => {
    console.log("Connected to Bybit WebSocket");
    ws.send(JSON.stringify({
      op: "subscribe",
      args: [`allLiquidation.${SYMBOL}`],
    }));
  };

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data as string);

    if (msg.topic?.startsWith("allLiquidation.")) {
      for (const item of msg.data ?? []) {
        const liq: Liquidation = {
          time: item.T,
          symbol: item.s,
          side: item.S,
          size: Number(item.v),
          bankruptcyPrice: Number(item.p),
        };
        liquidations.push(liq);

        const time = new Date(liq.time).toISOString().slice(11, 23);
        const emoji = liq.side === "Buy" ? "🔴" : "🟢";
        console.log(`  ${time} ${emoji} ${liq.side} ${liq.size} @ $${liq.bankruptcyPrice.toFixed(2)}`);
      }
    }
  };

  ws.onerror = (error) => {
    console.error("WebSocket error:", error);
  };

  ws.onclose = () => {
    console.log("WebSocket closed");
  };

  // Wait for duration
  await new Promise((r) => setTimeout(r, DURATION_MS));
  ws.close();

  // Summary
  const longs = liquidations.filter((l) => l.side === "Buy");
  const shorts = liquidations.filter((l) => l.side === "Sell");
  const totalSize = liquidations.reduce((s, l) => s + l.size, 0);

  console.log("\n=== Summary ===");
  console.log(`Total: ${liquidations.length} liquidations`);
  console.log(`Long liquidations: ${longs.length} (${longs.reduce((s, l) => s + l.size, 0).toFixed(2)} contracts)`);
  console.log(`Short liquidations: ${shorts.length} (${shorts.reduce((s, l) => s + l.size, 0).toFixed(2)} contracts)`);
  console.log(`Total size: ${totalSize.toFixed(2)} contracts`);

  // Price clusters
  const byPrice = new Map<number, { count: number; size: number }>();
  for (const l of liquidations) {
    const bucket = Math.round(l.bankruptcyPrice / 50) * 50;
    const existing = byPrice.get(bucket) ?? { count: 0, size: 0 };
    existing.count++;
    existing.size += l.size;
    byPrice.set(bucket, existing);
  }

  console.log("\nPrice clusters (by bankruptcy price):");
  const sorted = [...byPrice.entries()].sort((a, b) => b[1].size - a[1].size).slice(0, 10);
  for (const [price, stats] of sorted) {
    console.log(`  $${price.toFixed(0)}: ${stats.count} liquidations, ${stats.size.toFixed(2)} contracts`);
  }

  // Save
  await mkdir(".data", { recursive: true });
  const filename = `.data/liquidations-${SYMBOL}-${new Date().toISOString().slice(0, 16).replace(/:/g, "")}.json`;
  await writeFile(filename, JSON.stringify(liquidations, null, 2));
  console.log(`\nSaved ${liquidations.length} liquidations to ${filename}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
