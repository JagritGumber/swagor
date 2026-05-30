import { connectHyperliquidOrderflow, createOrderflowNdjsonWriter, intervalMs } from "../market-data";
import { sleep } from "../shared";
import { createOrderflowWindow } from "../strategy-lab/orderflow/create-orderflow-window";
import { readOrderflowWindow } from "../strategy-lab/orderflow/read-orderflow-window";
import { updateOrderflowWindow } from "../strategy-lab/orderflow/update-orderflow-window";
import { readMarketRegime } from "../strategy-lab/market-regime/read-market-regime";
import { readMarketAuction } from "../strategy-lab/read/read-market-auction";
import { createReaderAuctionModeState } from "../strategy-lab/reader-auction-mode/create-reader-auction-mode-state";
import { combineAuctionOrderflow } from "../strategy-lab/reader-live/combine-auction-orderflow";
import { createReaderSetupMemory } from "../strategy-lab/reader-setup/create-reader-setup-memory";
import { readMarketSetup } from "../strategy-lab/reader-setup/read-market-setup";
import { loadAuctionCandles } from "./load-auction-candles";
import type { LiveReaderSessionInput } from "./types";

export async function runLiveReaderSession(input: LiveReaderSessionInput): Promise<void> {
  const asset = input.asset.toUpperCase();
  let auctionCandles = await loadAuctionCandles({ ...input, asset });
  let auction = readMarketAuction({ asset, interval: input.interval, candles: auctionCandles });
  let auctionLoadedAt = Date.now();
  let auctionRefresh: Promise<void> | null = null;
  const auctionRefreshMs = input.auctionRefreshMs ?? intervalMs(input.interval);
  const window = createOrderflowWindow(input.orderflowWindowMs ?? 60_000);
  const auctionModeState = createReaderAuctionModeState();
  const readIntervalMs = input.readIntervalMs ?? 1000;
  const setupMemory = input.setupMemory ?? createReaderSetupMemory({
    ttlMs: input.setupConfig?.setupTtlMs ?? undefined,
    onEventError: input.onError,
  });
  let lastReadAt = 0;
  const writer = createOrderflowNdjsonWriter({
    rootDir: input.rootDir,
    network: input.network,
    onError: input.onError,
  });

  const connection = connectHyperliquidOrderflow({
    network: input.network,
    assets: [asset],
    onStatus: (status) => {
      input.onStatus?.(status);
      input.onSessionEvent?.({ type: "orderflow-status", status, at: Date.now() });
    },
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
    const liveAuction = orderflow.lastPrice === null
      ? auction
      : readMarketAuction({ asset, interval: input.interval, candles: auctionCandles, price: orderflow.lastPrice });
    const read = combineAuctionOrderflow({
      auction: liveAuction,
      orderflow,
      regime: readMarketRegime({ candles: auctionCandles, now }),
      auctionModeState,
      lastClosedCandle: auctionCandles[auctionCandles.length - 1] ?? null,
    });
    const setup = readMarketSetup({
      read,
      memory: setupMemory,
      now,
      config: {
        ...input.setupConfig,
        keyScope: input.setupConfig?.keyScope ?? input.network,
        tradePlanConfig: input.setupConfig?.tradePlanConfig ?? input.tradePlanConfig,
      },
    });
    const plan = setup.plan;
    input.onRead(read);
    input.onSetup?.(setup);
    input.onPlan?.(read, plan);
    input.onSessionEvent?.({
      type: "read-emitted",
      asset,
      stance: read.stance,
      planStatus: plan.status,
      setupStatus: setup.setup?.status ?? null,
      setupEvent: setup.events.at(-1)?.type ?? null,
      planSource: setup.planSource,
      at: now,
    });
  }

  function refreshAuctionIfDue(now: number): void {
    if (now - auctionLoadedAt < auctionRefreshMs || auctionRefresh) return;
    auctionRefresh = refreshAuction();
  }

  async function refreshAuction(): Promise<void> {
    input.onSessionEvent?.({ type: "auction-refresh-started", asset, at: Date.now() });
    try {
      auctionCandles = await loadAuctionCandles({ ...input, asset });
      auction = readMarketAuction({ asset, interval: input.interval, candles: auctionCandles });
      auctionLoadedAt = Date.now();
      input.onSessionEvent?.({ type: "auction-refresh-completed", asset, candleCount: auctionCandles.length, at: auctionLoadedAt });
    } catch (error: unknown) {
      auctionLoadedAt = Date.now();
      input.onSessionEvent?.({ type: "auction-refresh-failed", asset, message: errorMessage(error), at: auctionLoadedAt });
      input.onError?.(error);
    } finally {
      auctionRefresh = null;
    }
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
