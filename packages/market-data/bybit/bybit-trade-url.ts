export function bybitTradeUrl(input: {
  symbol: string;
  date: string;
  market?: "trading" | "spot";
}): string {
  const symbol = input.symbol.toUpperCase();
  const market = input.market ?? "trading";
  if (market === "spot") return `https://public.bybit.com/spot/${symbol}/${symbol}_${input.date}.csv.gz`;
  return `https://public.bybit.com/trading/${symbol}/${symbol}${input.date}.csv.gz`;
}
