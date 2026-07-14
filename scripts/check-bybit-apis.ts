const BASE_URL = "https://api.bybit.com";

async function checkAll() {
  // Open Interest
  const oiUrl = `${BASE_URL}/v5/market/open-interest?category=linear&symbol=BTCUSDT&intervalTime=1h&limit=3`;
  const oiResp = await fetch(oiUrl);
  const oiData = await oiResp.json() as any;
  console.log("Open Interest:");
  console.log(`  retCode: ${oiData.retCode}, retMsg: ${oiData.retMsg}`);
  if (oiData.result?.list?.[0]) {
    const latest = oiData.result.list[0];
    console.log(`  Latest: ${latest.openInterest} BTC (${latest.singleOpenInterest} single) @ ${new Date(Number(latest.timestamp)).toISOString()}`);
  }

  // Long/Short Ratio
  const lsUrl = `${BASE_URL}/v5/market/long-short-ratio?category=linear&symbol=BTCUSDT&intervalTime=1h&limit=3`;
  const lsResp = await fetch(lsUrl);
  const lsText = await lsResp.text();
  console.log(`\nLong/Short Ratio: ${lsText.slice(0, 200)}`);

  // Risk Limit
  const rlUrl = `${BASE_URL}/v5/market/risk-limit?category=linear&symbol=BTCUSDT`;
  const rlResp = await fetch(rlUrl);
  const rlData = await rlResp.json() as any;
  console.log("\nRisk Limit:");
  if (rlData.result?.list?.[0]) {
    const r = rlData.result.list[0];
    console.log(`  Risk limit: ${r.riskLimitValue} BTC`);
    console.log(`  Max leverage: ${r.maxLeverage}x`);
    console.log(`  Maintenance margin: ${r.maintenanceMargin}`);
  }

  // Tickers (for mark price)
  const tkUrl = `${BASE_URL}/v5/market/tickers?category=linear&symbol=BTCUSDT`;
  const tkResp = await fetch(tkUrl);
  const tkData = await tkResp.json() as any;
  console.log("\nTicker:");
  if (tkData.result?.list?.[0]) {
    const t = tkData.result.list[0];
    console.log(`  Last: $${t.lastPrice}`);
    console.log(`  Mark: $${t.markPrice}`);
    console.log(`  Index: $${t.indexPrice}`);
  }
}

checkAll().catch(console.error);
