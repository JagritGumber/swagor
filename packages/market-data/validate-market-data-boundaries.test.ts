import { describe, expect, test } from "bun:test";
import { validateHyperliquidCandles } from "./hyperliquid/validate-hyperliquid-candles";
import { parseOrderflowEventLine } from "./orderflow/parse-orderflow-event-line";
import { validateHyperliquidTradesData } from "./orderflow/validate-hyperliquid-orderflow-message";
import { validateVmExportSeries } from "./victoria-metrics/validate-vm-export-series";

describe("market-data validation boundaries", () => {
  test("rejects malformed Hyperliquid candle payloads with a useful error", () => {
    expect(() => validateHyperliquidCandles([{ t: "bad" }])).toThrow(/Hyperliquid candles validation failed/);
  });

  test("ignores irrelevant WebSocket messages but rejects malformed known channels", () => {
    expect(validateHyperliquidTradesData({ channel: "subscriptionResponse" })).toBeNull();
    expect(() => validateHyperliquidTradesData({
      channel: "trades",
      data: [{ coin: "BTC", side: "B", px: "100", sz: "1", time: 1, tid: 1 }],
    })).toThrow(/Hyperliquid trades message validation failed/);
  });

  test("rejects VictoriaMetrics series with mismatched values and timestamps", () => {
    expect(() => validateVmExportSeries({
      metric: {},
      values: [1, 2],
      timestamps: [1],
    })).toThrow(/values\/timestamps length mismatch/);
  });

  test("parses stored orderflow lines through schema validation", () => {
    const events = parseOrderflowEventLine(JSON.stringify({
      venue: "hyperliquid",
      network: "mainnet",
      asset: "BTC",
      receivedAt: 1,
      channel: "trades",
      raw: {},
      events: [{
        type: "trade",
        receivedAt: 1,
        trade: {
          asset: "BTC",
          side: "buy",
          price: 100,
          size: 1,
          time: 1,
          id: "1:BTC:1",
        },
      }],
    }));

    expect(events).toHaveLength(1);
    expect(events[0]?.type).toBe("trade");
  });
});

