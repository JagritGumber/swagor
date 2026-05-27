import { connectHyperliquidOrderflow, createOrderflowNdjsonWriter } from "../market-data";
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
  const auction = await loadAuctionRead({ ...input, asset });
  const window = createOrderflowWindow(60_000);
  const writer = createOrderflowNdjsonWriter({
    rootDir: input.rootDir,
    network: input.network,
  });

  const interval = setInterval(() => {
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
    await writer.close();
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
