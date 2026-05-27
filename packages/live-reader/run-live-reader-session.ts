import { connectHyperliquidOrderflow, createOrderflowNdjsonWriter, intervalMs } from "../market-data";
import {
  combineAuctionOrderflow,
  buildReaderTradePlan,
  createOrderflowWindow,
  readOrderflowWindow,
  updateOrderflowWindow,
} from "../strategy-lab";
import { sleep } from "../shared";
import { loadAuctionRead } from "./load-auction-read";
import type { LiveReaderSessionInput } from "./types";

export async function runLiveReaderSession(input: LiveReaderSessionInput): Promise<void> {
  const asset = input.asset.toUpperCase();
  let auction = await loadAuctionRead({ ...input, asset });
  let auctionLoadedAt = Date.now();
  let auctionRefresh: Promise<void> | null = null;
  const auctionRefreshMs = input.auctionRefreshMs ?? intervalMs(input.interval);
  const window = createOrderflowWindow(input.orderflowWindowMs ?? 60_000);
  const readIntervalMs = input.readIntervalMs ?? 1000;
  let lastReadAt = 0;
  const writer = createOrderflowNdjsonWriter({
    rootDir: input.rootDir,
    network: input.network,
  });

  const connection = connectHyperliquidOrderflow({
    network: input.network,
    assets: [asset],
    onStatus: input.onStatus,
    onError: input.onError,
    onRecord: (record) => writer.append(record),
    onEvent: (event) => {
      updateOrderflowWindow(window, event);
      emitReadIfDue();
    },
  });

  try {
    await sleep(input.seconds * 1000);
  } finally {
    connection.close();
    if (auctionRefresh) await auctionRefresh;
    await writer.close();
  }

  function emitReadIfDue(): void {
    const now = Date.now();
    if (now - lastReadAt < readIntervalMs) return;
    lastReadAt = now;
    refreshAuctionIfDue(now);
    const orderflow = readOrderflowWindow({ asset, window });
    const read = combineAuctionOrderflow({ auction, orderflow });
    input.onRead(read);
    if (input.onPlan) input.onPlan(read, buildReaderTradePlan(read, input.tradePlanConfig));
  }

  function refreshAuctionIfDue(now: number): void {
    if (now - auctionLoadedAt < auctionRefreshMs || auctionRefresh) return;
    auctionRefresh = refreshAuction();
  }

  async function refreshAuction(): Promise<void> {
    try {
      auction = await loadAuctionRead({ ...input, asset });
      auctionLoadedAt = Date.now();
    } catch (error: unknown) {
      auctionLoadedAt = Date.now();
      input.onError?.(error);
    } finally {
      auctionRefresh = null;
    }
  }
}
