const BASE_URL = "https://api.bybit.com";

async function fetchOpenInterest() {
  const url = `${BASE_URL}/v5/market/open-interest?category=linear&symbol=BTCUSDT&intervalTime=1h&limit=24`;
  const response = await fetch(url);
  const data = await response.json() as any;
  console.log("=== Open Interest (24h) ===");
  console.log(JSON.stringify(data.result?.list?.slice(0, 5), null, 2));
}

async function fetchLongShortRatio() {
  const url = `${BASE_URL}/v5/market/long-short-ratio?category=linear&symbol=BTCUSDT&intervalTime=1h&limit=24`;
  const response = await fetch(url);
  const data = await response.json() as any;
  console.log("\n=== Long/Short Ratio (24h) ===");
  console.log(JSON.stringify(data.result?.list?.slice(0, 5), null, 2));
}

async function fetchRiskLimit() {
  const url = `${BASE_URL}/v5/market/risk-limit?category=linear&symbol=BTCUSDT`;
  const response = await fetch(url);
  const data = await response.json() as any;
  console.log("\n=== Risk Limit ===");
  if (data.result?.list?.[0]) {
    const r = data.result.list[0];
    console.log(`Risk limit value: ${r.riskLimitValue}`);
    console.log(`Maintenance margin: ${r.maintenanceMargin}`);
    console.log(`Max leverage: ${r.maxLeverage}`);
  }
}

async function main() {
  await fetchOpenInterest();
  await fetchLongShortRatio();
  await fetchRiskLimit();
}

main().catch(console.error);
