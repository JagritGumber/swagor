const HL = "https://api.hyperliquid-testnet.xyz/info";

async function post<T>(body: unknown): Promise<T> {
  const res = await fetch(HL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HL ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

export type Candle = {
  t: number;
  o: string;
  c: string;
  h: string;
  l: string;
  v: string;
  n: number;
};

export function fetchCandles(
  coin: string,
  interval: string,
  startMs: number,
  endMs: number,
): Promise<Candle[]> {
  return post<Candle[]>({
    type: "candleSnapshot",
    req: { coin, interval, startTime: startMs, endTime: endMs },
  });
}
