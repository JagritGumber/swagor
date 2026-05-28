import { describe, expect, test } from "bun:test";
import type { LiveReaderRead } from "../reader-live/types";
import { createReaderSetupMemory } from "./create-reader-setup-memory";
import { readerSetupKeyFor } from "./reader-setup-key-for";
import { readMarketSetup } from "./read-market-setup";
import type { ReaderSetupMemory } from "./types";
import type { ReaderActionableTradePlan } from "../trade-plan/types";

describe("readMarketSetup", () => {
  test("keeps a reclaim setup and promotes it when price reclaims the entry zone", () => {
    const memory = createReaderSetupMemory();
    const waiting = readMarketSetup({
      memory,
      now: 10,
      read: readerRead({
        levelKind: "support",
        location: "below-value",
        pressure: "sell-pressure",
        events: ["stalled-selling"],
        stance: "possible-long",
        lastPrice: 98,
      }),
    });

    expect(waiting.plan.status).toBe("ready-if-reclaim");
    expect(waiting.setup?.status).toBe("waiting-reclaim");
    expect(waiting.events[0]?.type).toBe("setup-created");

    const ready = readMarketSetup({
      memory,
      now: 20,
      read: readerRead({
        levelKind: "support",
        location: "value-low",
        pressure: "balanced",
        events: [],
        stance: "wait",
        lastPrice: 99,
      }),
    });

    expect(ready.plan.status).toBe("ready");
    expect(ready.setup?.status).toBe("ready");
    expect(ready.planSource).toBe("memory-promoted");
    expect(ready.events[0]?.type).toBe("setup-ready");
    expect(ready.plan.reasons).toContain("tracked setup reclaimed entry zone");
  });

  test("does not promote a reclaim while current orderflow is hostile", () => {
    const memory = createReaderSetupMemory();
    readMarketSetup({
      memory,
      now: 10,
      read: readerRead({
        levelKind: "support",
        location: "below-value",
        pressure: "sell-pressure",
        events: ["stalled-selling"],
        stance: "possible-long",
        lastPrice: 98,
      }),
    });

    const held = readMarketSetup({
      memory,
      now: 20,
      read: readerRead({
        levelKind: "support",
        location: "value-low",
        pressure: "sell-pressure",
        events: [],
        stance: "watch-long-confirmation",
        lastPrice: 99,
      }),
    });

    expect(held.plan.status).toBe("ready-if-reclaim");
    expect(held.setup?.status).toBe("waiting-reclaim");
    expect(held.planSource).toBe("memory-held");
  });

  test("holds a valid setup when the next read is weaker noise", () => {
    const memory = createReaderSetupMemory();
    readMarketSetup({
      memory,
      now: 10,
      read: readerRead({
        levelKind: "support",
        location: "below-value",
        pressure: "sell-pressure",
        events: [],
        stance: "watch-long-confirmation",
        lastPrice: 98,
      }),
    });

    const held = readMarketSetup({
      memory,
      now: 20,
      read: readerRead({
        levelKind: "support",
        location: "below-value",
        pressure: "balanced",
        events: [],
        stance: "wait",
        lastPrice: 99,
      }),
    });

    expect(held.plan.status).toBe("watch");
    expect(held.setup?.status).toBe("watching");
    expect(held.planSource).toBe("memory-held");
    expect(held.events[0]?.type).toBe("setup-held");
  });

  test("invalidates a tracked setup when auction context is gone", () => {
    const memory = createReaderSetupMemory();
    readMarketSetup({
      memory,
      now: 10,
      read: readerRead({
        levelKind: "support",
        location: "below-value",
        pressure: "sell-pressure",
        events: [],
        stance: "watch-long-confirmation",
        lastPrice: 98,
      }),
    });

    const invalidated = readMarketSetup({
      memory,
      now: 20,
      read: readerRead({
        levelKind: "support",
        location: "near-poc",
        pressure: "balanced",
        events: [],
        stance: "wait",
        lastPrice: 100,
      }),
    });

    expect(invalidated.plan.status).toBe("no-trade");
    expect(invalidated.planSource).toBe("none");
    expect(invalidated.events[0]?.type).toBe("setup-invalidated");
  });

  test("invalidates a tracked long setup when price crosses the stop", () => {
    const memory = createReaderSetupMemory();
    readMarketSetup({
      memory,
      now: 10,
      read: readerRead({
        levelKind: "support",
        location: "below-value",
        pressure: "sell-pressure",
        events: ["stalled-selling"],
        stance: "possible-long",
        lastPrice: 98,
      }),
    });

    const invalidated = readMarketSetup({
      memory,
      now: 20,
      read: readerRead({
        levelKind: "support",
        location: "below-value",
        pressure: "sell-pressure",
        events: [],
        stance: "watch-long-confirmation",
        lastPrice: 97,
      }),
    });

    expect(invalidated.plan.status).toBe("no-trade");
    expect(invalidated.events[0]?.type).toBe("setup-invalidated");
    expect(memory.get(readerSetupKeyFor({ asset: "BTC", interval: "5m" }))).toBeNull();
  });

  test("expires stale setup memory before reading a new setup", () => {
    const memory = createReaderSetupMemory({ ttlMs: 10 });
    readMarketSetup({
      memory,
      now: 10,
      read: readerRead({
        levelKind: "support",
        location: "below-value",
        pressure: "sell-pressure",
        events: [],
        stance: "watch-long-confirmation",
        lastPrice: 98,
      }),
    });

    const result = readMarketSetup({
      memory,
      now: 21,
      read: readerRead({
        levelKind: null,
        location: "near-poc",
        pressure: "balanced",
        events: [],
        stance: "wait",
        lastPrice: 99,
      }),
    });

    expect(result.plan.status).toBe("no-trade");
    expect(result.events.map((event) => event.type)).toEqual(["setup-expired", "setup-none"]);
  });

  test("scopes setup memory by asset interval and configured scope", () => {
    const memory = createReaderSetupMemory();
    const result = readMarketSetup({
      memory,
      now: 10,
      config: { keyScope: "mainnet" },
      read: readerRead({
        levelKind: "support",
        location: "below-value",
        pressure: "sell-pressure",
        events: [],
        stance: "watch-long-confirmation",
        lastPrice: 98,
      }),
    });

    expect(result.setup?.key).toBe("MAINNET|BTC|5m");
    expect(memory.get("BTC")).toBeNull();
    expect(memory.get("MAINNET|BTC|5m")?.value.scope).toBe("mainnet");
  });
});

describe("readMarketSetup replay results", () => {
  test("support reclaim enters and reaches target before stop", () => {
    const result = replayReader([
      {
        read: readerRead({
          levelKind: "support",
          location: "below-value",
          pressure: "sell-pressure",
          events: ["stalled-selling"],
          stance: "possible-long",
          lastPrice: 98,
        }),
      },
      {
        read: readerRead({
          levelKind: "support",
          location: "value-low",
          pressure: "balanced",
          events: [],
          stance: "wait",
          lastPrice: 99,
        }),
      },
      {
        read: readerRead({
          levelKind: "support",
          location: "value-low",
          pressure: "balanced",
          events: [],
          stance: "wait",
          lastPrice: 105,
        }),
      },
    ]);

    expect(result.entries).toHaveLength(1);
    expect(result.exit?.reason).toBe("target");
    expect(result.exit?.r).toBe(6);
  });

  test("hostile reclaim avoids a long entry before the stop breaks", () => {
    const result = replayReader([
      {
        read: readerRead({
          levelKind: "support",
          location: "below-value",
          pressure: "sell-pressure",
          events: ["stalled-selling"],
          stance: "possible-long",
          lastPrice: 98,
        }),
      },
      {
        read: readerRead({
          levelKind: "support",
          location: "value-low",
          pressure: "sell-pressure",
          events: [],
          stance: "watch-long-confirmation",
          lastPrice: 99,
        }),
      },
      {
        read: readerRead({
          levelKind: "support",
          location: "below-value",
          pressure: "sell-pressure",
          events: [],
          stance: "watch-long-confirmation",
          lastPrice: 97,
        }),
      },
    ]);

    expect(result.entries).toHaveLength(0);
    expect(result.lastPlan?.status).toBe("no-trade");
    expect(result.lastEvents).toContain("setup-invalidated");
  });

  test("changed auction context clears setup and avoids the later touch", () => {
    const result = replayReader([
      {
        read: readerRead({
          levelKind: "support",
          location: "below-value",
          pressure: "sell-pressure",
          events: [],
          stance: "watch-long-confirmation",
          lastPrice: 98,
        }),
      },
      {
        read: readerRead({
          levelKind: "support",
          location: "near-poc",
          pressure: "balanced",
          events: [],
          stance: "wait",
          lastPrice: 100,
        }),
      },
      {
        read: readerRead({
          levelKind: "support",
          location: "value-low",
          pressure: "balanced",
          events: [],
          stance: "wait",
          lastPrice: 99,
        }),
      },
    ]);

    expect(result.entries).toHaveLength(0);
    expect(result.lastPlan?.status).toBe("no-trade");
  });

  test("resistance reclaim enters short and reaches target before stop", () => {
    const result = replayReader([
      {
        read: readerRead({
          levelKind: "resistance",
          location: "above-value",
          pressure: "buy-pressure",
          events: ["stalled-buying"],
          stance: "possible-short",
          lastPrice: 102,
        }),
      },
      {
        read: readerRead({
          levelKind: "resistance",
          location: "value-high",
          pressure: "balanced",
          events: [],
          stance: "wait",
          lastPrice: 101,
        }),
      },
      {
        read: readerRead({
          levelKind: "resistance",
          location: "value-high",
          pressure: "balanced",
          events: [],
          stance: "wait",
          lastPrice: 95,
        }),
      },
    ]);

    expect(result.entries).toHaveLength(1);
    expect(result.exit?.reason).toBe("target");
    expect(result.exit?.r).toBe(6);
  });

  test("stale setup does not enter after expiry", () => {
    const memory = createReaderSetupMemory({ ttlMs: 10 });
    const result = replayReader([
      {
        now: 10,
        read: readerRead({
          levelKind: "support",
          location: "below-value",
          pressure: "sell-pressure",
          events: ["stalled-selling"],
          stance: "possible-long",
          lastPrice: 98,
        }),
      },
      {
        now: 21,
        read: readerRead({
          levelKind: "support",
          location: "value-low",
          pressure: "balanced",
          events: [],
          stance: "wait",
          lastPrice: 99,
        }),
      },
    ], memory);

    expect(result.entries).toHaveLength(0);
    expect(result.lastEvents).toContain("setup-expired");
  });
});

function readerRead(input: {
  levelKind: "support" | "resistance" | null;
  location: LiveReaderRead["auction"]["location"];
  pressure: LiveReaderRead["orderflow"]["pressure"];
  events: string[];
  stance: LiveReaderRead["stance"];
  lastPrice: number | null;
}): LiveReaderRead {
  return {
    asset: "BTC",
    stance: input.stance,
    narrative: "test read",
    invalidation: "test invalidation",
    target: "test target",
    auction: {
      asset: "BTC",
      interval: "5m",
      level: input.levelKind
        ? {
            price: 100,
            kind: input.levelKind,
            touches: 3,
            firstTouchedAt: 1,
            lastTouchedAt: 2,
          }
        : null,
      profile: {
        low: 90,
        high: 110,
        binSize: 2,
        poc: 105,
        valueAreaLow: 95,
        valueAreaHigh: 108,
        bins: [],
      },
      location: input.location,
      bias: input.levelKind === "support" ? "long" : input.levelKind === "resistance" ? "short" : "wait",
      narrative: "auction read",
      invalidation: "auction invalidation",
      target: "auction target",
    },
    orderflow: {
      asset: "BTC",
      windowSeconds: 60,
      lastPrice: input.lastPrice,
      buyVolume: input.pressure === "buy-pressure" ? 12 : 4,
      sellVolume: input.pressure === "sell-pressure" ? 12 : 4,
      delta: input.pressure === "buy-pressure" ? 8 : input.pressure === "sell-pressure" ? -8 : 0,
      tradeCount: 4,
      averageTradeSize: 2,
      largestTrade: null,
      dominantSide: input.pressure === "buy-pressure" ? "buy" : input.pressure === "sell-pressure" ? "sell" : "none",
      pressure: input.pressure,
      events: input.events,
      narrative: "orderflow read",
    },
  };
}

type ReplayStep = {
  now?: number;
  read: LiveReaderRead;
};

type ReplayEntry = {
  side: ReaderActionableTradePlan["side"];
  price: number;
  plan: ReaderActionableTradePlan;
};

type ReplayExit = {
  reason: "target" | "stop";
  price: number;
  r: number;
};

function replayReader(steps: ReplayStep[], memory: ReaderSetupMemory = createReaderSetupMemory()) {
  const entries: ReplayEntry[] = [];
  let open: ReplayEntry | null = null;
  let exit: ReplayExit | null = null;
  let lastPlan: ReturnType<typeof readMarketSetup>["plan"] | null = null;
  let lastEvents: string[] = [];

  for (const [index, step] of steps.entries()) {
    const result = readMarketSetup({ memory, now: step.now ?? index + 1, read: step.read });
    const lastPrice = step.read.orderflow.lastPrice;
    lastPlan = result.plan;
    lastEvents = result.events.map((event) => event.type);

    if (!open && result.plan.status === "ready" && lastPrice !== null) {
      open = { side: result.plan.side, price: lastPrice, plan: result.plan };
      entries.push(open);
    }

    if (open && lastPrice !== null) {
      exit = exitFor(open, lastPrice);
      if (exit) break;
    }
  }

  return { entries, exit, lastPlan, lastEvents };
}

function exitFor(entry: ReplayEntry, price: number): ReplayExit | null {
  const plan = entry.plan;
  if (plan.side === "long") {
    if (price <= plan.stop) return replayExit("stop", price, entry.price, plan.stop, plan.side);
    if (price >= plan.target) return replayExit("target", price, entry.price, plan.stop, plan.side);
    return null;
  }
  if (price >= plan.stop) return replayExit("stop", price, entry.price, plan.stop, plan.side);
  if (price <= plan.target) return replayExit("target", price, entry.price, plan.stop, plan.side);
  return null;
}

function replayExit(
  reason: ReplayExit["reason"],
  price: number,
  entryPrice: number,
  stop: number,
  side: ReaderActionableTradePlan["side"],
): ReplayExit {
  const risk = Math.abs(entryPrice - stop);
  const pnl = side === "long" ? price - entryPrice : entryPrice - price;
  return {
    reason,
    price,
    r: Number((pnl / risk).toFixed(4)),
  };
}
