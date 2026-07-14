async function main() {
  const url = "https://api.bybit.com/v5/market/recent-trade?symbol=BTCUSDT&category=linear&limit=5";
  const response = await fetch(url);
  const data = await response.json() as any;

  console.log("API response structure:");
  console.log(JSON.stringify(data, null, 2));

  if (data.result?.list?.length > 0) {
    console.log("\nFirst trade fields:");
    const trade = data.result.list[0];
    for (const [key, value] of Object.entries(trade)) {
      console.log(`  ${key}: ${value} (${typeof value})`);
    }
  }
}

main().catch(console.error);
