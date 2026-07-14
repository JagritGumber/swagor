async function main() {
  const url = "https://api.bybit.com/v5/position/liquidation?category=linear&symbol=BTCUSDT&limit=10";
  console.log("Fetching:", url);

  const response = await fetch(url);
  console.log("Status:", response.status);
  console.log("Headers:", Object.fromEntries(response.headers.entries()));

  const text = await response.text();
  console.log("Body:", text.slice(0, 500));
}

main().catch(console.error);
