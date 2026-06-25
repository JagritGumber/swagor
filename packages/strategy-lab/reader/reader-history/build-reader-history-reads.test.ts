import { describe, expect, test } from "bun:test";
import type { OrderflowEvent } from "../../read-core/orderflow/types";
import type { Candle } from "../../types";
import { buildReaderHistoryReads } from "./build-reader-history-reads";
import { runReaderHistoryReplay } from "./run-reader-history-replay";

describe("buildReaderHistoryReads", () => {
  test("builds timestamped live reader reads from candles and orderflow events", () => {
    const steps = buildReaderHistoryReads({
      asset: "btc",
      interval: "5m",
      candleIntervalMs: 1_000,
      candles: candles(),
      orderflowEvents: [
        bbo(1_000, 97.5, 98.5),
        trade(1_000, "sell", 98, 3),
        trade(2_000, "sell", 98.2, 2),
      ],
      readIntervalMs: 1_000,
      orderflowWindowMs: 5_000,
      startAt: 1_000,
      endAt: 2_000,
      auctionConfig: looseAuctionConfig(),
    });

    expect(steps).toHaveLength(2);
    expect(steps[0]?.now).toBe(1_000);
    expect(steps[0]?.read.asset).toBe("BTC");
    expect(steps[0]?.read.orderflow.lastPrice).toBe(98);
    expect(steps[1]?.read.orderflow.tradeCount).toBe(2);
  });

  test("sorts candles and events before building reads", () => {
    const steps = buildReaderHistoryReads({
      asset: "BTC",
      interval: "5m",
      candleIntervalMs: 1_000,
      candles: [...candles()].reverse(),
      orderflowEvents: [
        trade(2_000, "buy", 101, 2),
        bbo(1_000, 99, 101),
        trade(1_000, "buy", 100, 1),
      ],
      readIntervalMs: 1_000,
      orderflowWindowMs: 5_000,
      startAt: 1_000,
      endAt: 2_000,
      auctionConfig: looseAuctionConfig(),
    });

    expect(steps[0]?.read.orderflow.lastPrice).toBe(100);
    expect(steps[1]?.read.orderflow.lastPrice).toBe(101);
  });

  test("expires historical orderflow by read time", () => {
    const steps = buildReaderHistoryReads({
      asset: "BTC",
      interval: "5m",
      candleIntervalMs: 1_000,
      candles: candles(),
      orderflowEvents: [
        trade(1_000, "buy", 100, 1),
        trade(4_000, "buy", 101, 1),
      ],
      readIntervalMs: 3_000,
      orderflowWindowMs: 1_000,
      startAt: 1_000,
      endAt: 4_000,
      auctionConfig: looseAuctionConfig(),
    });

    expect(steps[0]?.read.orderflow.tradeCount).toBe(1);
    expect(steps[1]?.read.orderflow.tradeCount).toBe(1);
    expect(steps[1]?.read.orderflow.lastPrice).toBe(101);
  });

  test("ignores orderflow events for other assets", () => {
    const steps = buildReaderHistoryReads({
      asset: "BTC",
      interval: "5m",
      candleIntervalMs: 1_000,
      candles: candles(),
      orderflowEvents: [
        trade(1_000, "buy", 100, 1, "ETH"),
        trade(1_000, "sell", 98, 2, "BTC"),
      ],
      readIntervalMs: 1_000,
      orderflowWindowMs: 5_000,
      startAt: 1_000,
      endAt: 1_000,
      auctionConfig: looseAuctionConfig(),
    });

    expect(steps[0]?.read.orderflow.tradeCount).toBe(1);
    expect(steps[0]?.read.orderflow.lastPrice).toBe(98);
  });

  test("rejects non-positive read intervals", () => {
    expect(() => buildReaderHistoryReads({
      asset: "BTC",
      interval: "5m",
      candleIntervalMs: 1_000,
      candles: candles(),
      orderflowEvents: [],
      readIntervalMs: 0,
    })).toThrow("reader history readIntervalMs must be a positive finite number");
  });

  test("uses only closed candles at each read", () => {
    const steps = buildReaderHistoryReads({
      asset: "BTC",
      interval: "5m",
      candleIntervalMs: 1_000,
      candles: [
        ...candles(),
        candle(8_000, 200, 210, 190, 205),
      ],
      orderflowEvents: [
        trade(8_000, "buy", 100, 1),
      ],
      readIntervalMs: 1_000,
      orderflowWindowMs: 5_000,
      startAt: 8_000,
      endAt: 8_000,
      auctionConfig: looseAuctionConfig(),
    });

    expect(steps[0]?.read.auction.profile?.high).toBeLessThan(200);
  });

  test("builds local range from the configured auction window", () => {
    const steps = buildReaderHistoryReads({
      asset: "BTC",
      interval: "5m",
      candleIntervalMs: 1_000,
      candles: candles(),
      orderflowEvents: [
        trade(8_000, "buy", 101, 1),
      ],
      readIntervalMs: 1_000,
      orderflowWindowMs: 5_000,
      startAt: 8_000,
      endAt: 8_000,
      auctionConfig: {
        ...looseAuctionConfig(),
        localRangeCandles: 2,
      },
    });

    expect(steps[0]?.read.localRange).toMatchObject({
      high: 104,
      low: 99,
      location: "middle",
    });
  });

  test("rejects non-positive local range windows", () => {
    expect(() => buildReaderHistoryReads({
      asset: "BTC",
      interval: "5m",
      candleIntervalMs: 1_000,
      candles: candles(),
      orderflowEvents: [],
      readIntervalMs: 1_000,
      auctionConfig: {
        ...looseAuctionConfig(),
        localRangeCandles: 0,
      },
    })).toThrow("reader history localRangeCandles must be a positive finite number");
  });

  test("aligns reads to configured grid", () => {
    const steps = buildReaderHistoryReads({
      asset: "BTC",
      interval: "5m",
      candleIntervalMs: 1_000,
      candles: candles(),
      orderflowEvents: [],
      readIntervalMs: 1_000,
      alignReadsToMs: 1_000,
      startAt: 1_250,
      endAt: 3_000,
      auctionConfig: looseAuctionConfig(),
    });

    expect(steps.map((step) => step.now)).toEqual([2_000, 3_000]);
  });

  test("runs history reads through reader replay", () => {
    const result = runReaderHistoryReplay({
      asset: "BTC",
      interval: "5m",
      candleIntervalMs: 1_000,
      candles: candles(),
      orderflowEvents: [
        bbo(8_000, 97.5, 98.5),
        trade(8_000, "sell", 98, 4),
        bbo(9_000, 98.5, 99.5),
        trade(9_000, "buy", 99, 4),
        bbo(10_000, 104.5, 105.5),
        trade(10_000, "buy", 105, 4),
      ],
      readIntervalMs: 1_000,
      orderflowWindowMs: 5_000,
      startAt: 8_000,
      endAt: 10_000,
      auctionConfig: looseAuctionConfig(),
      replay: {
        setupConfig: { setupTtlMs: 10_000 },
      },
    });

    expect(result.historySteps).toHaveLength(3);
    expect(result.summary.totalReads).toBe(3);
    expect(result.setupResults).toHaveLength(3);
  });

  test("returns no reads when no historical time bounds exist", () => {
    const steps = buildReaderHistoryReads({
      asset: "BTC",
      interval: "5m",
      candleIntervalMs: 1_000,
      candles: [],
      orderflowEvents: [],
      readIntervalMs: 1_000,
    });

    expect(steps).toEqual([]);
  });
});

function candles(): Candle[] {
  return [
    candle(0, 105, 106, 104, 105),
    candle(1_000, 103, 104, 102, 103),
    candle(2_000, 100, 101, 99, 100),
    candle(3_000, 103, 104, 102, 103),
    candle(4_000, 106, 107, 105, 106),
    candle(5_000, 102, 103, 101, 102),
    candle(6_000, 100, 101, 99, 100),
    candle(7_000, 103, 104, 102, 103),
  ];
}

function candle(t: number, o: number, h: number, l: number, c: number): Candle {
  return { t, o, h, l, c, v: 10 };
}

function trade(time: number, side: "buy" | "sell", price: number, size: number, asset = "BTC"): OrderflowEvent {
  return {
    type: "trade",
    receivedAt: time,
    trade: {
      asset,
      side,
      price,
      size,
      time,
      id: `${time}-${side}-${price}`,
    },
  };
}

function bbo(time: number, bidPrice: number, askPrice: number): OrderflowEvent {
  return {
    type: "bbo",
    receivedAt: time,
    bbo: {
      asset: "BTC",
      bidPrice,
      bidSize: 1,
      askPrice,
      askSize: 1,
      time,
    },
  };
}

function looseAuctionConfig() {
  return {
    swingLeft: 1,
    swingRight: 1,
    levelMinTouches: 1,
    maxLevelDistancePct: 0.05,
    profileCandles: 8,
    profileBins: 8,
  };
}



