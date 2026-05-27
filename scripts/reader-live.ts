import { formatLiveReaderRead, runLiveReaderSession } from "../packages/live-reader";
import type { CandleInterval, HyperliquidNetwork } from "../packages/market-data";

function arg(name: string, fallback?: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function parseNetwork(value: string | undefined): HyperliquidNetwork {
  return value === "testnet" ? "testnet" : "mainnet";
}

function parseInterval(value: string | undefined): CandleInterval {
  return value === "5m" ? "5m" : "1h";
}

async function main(): Promise<void> {
  const vmUrl = arg("vm-url", "http://localhost:8428")!;
  const network = parseNetwork(arg("network", "mainnet"));
  const asset = arg("asset", "BTC")!.toUpperCase();
  const interval = parseInterval(arg("interval", "1h"));
  const days = Number(arg("days", interval === "1h" ? "180" : "30"));
  const seconds = Number(arg("seconds", "60"));
  const rootDir = arg("root-dir", "orderflow-data")!;
  if (!Number.isFinite(days) || days <= 0) throw new Error("--days must be a positive number");
  if (!Number.isFinite(seconds) || seconds <= 0) throw new Error("--seconds must be a positive number");

  await runLiveReaderSession({
    vmUrl,
    network,
    asset,
    interval,
    days,
    seconds,
    rootDir,
    onStatus: (status) => console.error(`[reader:live] ${status}`),
    onError: (error) => console.error("[reader:live] websocket error", error),
    onRead: (read) => console.log(JSON.stringify(formatLiveReaderRead(read))),
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
