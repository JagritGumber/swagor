import { connectHyperliquidOrderflow, createOrderflowNdjsonWriter, intervalMs } from "../market-data";
import {
  combineAuctionOrderflow,
  createOrderflowWindow,
  readOrderflowWindow,
  updateOrderflowWindow,
} from "../strategy-lab";
import { loadAuctionRead } from "./load-auction-read";
import type { LiveReaderSessionInput } from "./types";

export async function runLiveReaderSession(input: LiveReaderSessionInput): Promise<void> {
  const asset = input.asset.toUpperCase();
  let auction = await loadAuctionRead({ ...input, asset });
  let auctionLoadedAt = Date.now();
  let auctionRefresh: Promise<void> | null = null;
  const auctionRefreshMs = input.auctionRefreshMs ?? intervalMs(input.interval);
  const window = createOrderflowWindow(input.orderflowWindowMs ?? 60_000);
  const writer = createOrderflowNdjsonWriter({
    rootDir: input.rootDir,
    network: input.network,
  });

  const interval = setInterval(() => {
    const now = Date.now();
    if (now - auctionLoadedAt >= auctionRefreshMs) {
      auctionRefresh ??= loadAuctionRead({ ...input, asset })
        .then((nextAuction) => {
          auction = nextAuction;
          auctionLoadedAt = Date.now();
        })
        .catch((error: unknown) => {
          auctionLoadedAt = Date.now();
          input.onError?.(error);
        })
        .finally(() => {
          auctionRefresh = null;
        });
    }
    const orderflow = readOrderflowWindow({ asset, window });
    input.onRead(combineAuctionOrderflow({ auction, orderflow }));
  }, input.readIntervalMs ?? 1000);

  const connection = connectHyperliquidOrderflow({
    network: input.network,
    assets: [asset],
    onStatus: input.onStatus,
    onError: input.onError,
    onRecord: (record) => writer.append(record),
    onEvent: (event) => updateOrderflowWindow(window, event),
  });

  try {
    await sleep(input.seconds * 1000);
  } finally {
    clearInterval(interval);
    connection.close();
    if (auctionRefresh) await auctionRefresh;
    await writer.close();
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
