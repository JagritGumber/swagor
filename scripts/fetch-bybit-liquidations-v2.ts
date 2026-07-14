const BASE_URL = "https://api.bybit.com";

type Liquidation = {
  time: number;
  symbol: string;
  side: "Buy" | "Sell";
  size: number;
  price: number;
  leverage: string;
  bankruptcyPrice: string;
  orderId: string;
 ExecType: string;
};

async function fetchLiquidations(symbol: string, limit: number = 200): Promise<Liquidation[]> {
  const url = `${BASE_URL}/v5/position/liquidation?category=linear&symbol=${symbol}&limit=${limit}`;
  const response = await fetch(url);
  const data = await response.json() as any;

  console.log("API response:", JSON.stringify(data, null, 2));

  if (data.retCode !== 0) {
    throw new Error(`Bybit API error: ${data.retMsg}`);
  }

  return data.result.list.map((item: any) => ({
    time: Number(item.updatedTime),
    symbol: item.symbol,
    side: item.side as "Buy" | "Sell",
    size: Number(item.size),
    price: Number(item.averagePrice),
    leverage: item.leverage,
    bankruptcyPrice: item.bankruptcyPrice,
    orderId: item.orderId,
    ExecType: item.execType,
  }));
}

async function main() {
  const symbol = process.argv[2] ?? "BTCUSDT";

  console.log(`Fetching liquidations for ${symbol}...`);
  const liquidations = await fetchLiquidations(symbol);

  console.log(`\nFound ${liquidations.length} liquidations`);

  if (liquidations.length > 0) {
    console.log("\nRecent liquidations:");
    for (const l of liquidations.slice(0, 10)) {
      const time = new Date(l.time).toISOString();
      console.log(`  ${time} ${l.side} ${l.size} @ $${l.price.toFixed(2)} (leverage: ${l.leverage}x)`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
