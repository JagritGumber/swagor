import { describe, expect, test } from "bun:test";
import type { LiveReaderRead } from "../reader-live/types";
import type { ReaderSetupResult } from "../reader-setup/types";
import type { ReaderTradePlan } from "../trade-plan/types";
import { createReaderRadarMemory } from "./create-reader-radar-memory";
import { updateReaderRadar } from "./update-reader-radar";

describe("updateReaderRadar", () => {
  test("keeps a rejected directional candidate alive across forming reads", () => {
    const memory = createReaderRadarMemory();

    const born = updateReaderRadar({
      memory,
      config: { mode: "shadow" },
      now: 1,
      setup: setupResult(noTradePlan(["reader is waiting"]), readerRead({ location: "value-low", pressure: "balanced", lastPrice: 101 })),
    });
    const improved = updateReaderRadar({
      memory,
      config: { mode: "shadow" },
      now: 2,
      setup: setupResult(noTradePlan(["reader is still waiting"]), readerRead({ location: "value-low", pressure: "balanced", lastPrice: 102 })),
    });

    expect(born.events.map((event) => event.type)).toContain("radar-born");
    expect(improved.events.map((event) => event.type)).toContain("radar-improved");
    expect(improved.candidate?.readCount).toBe(2);
    expect(improved.promoted).toBe(false);
  });

  test("does not turn POC chop into a trade candidate", () => {
    const memory = createReaderRadarMemory();
    const update = updateReaderRadar({
      memory,
      config: { mode: "shadow" },
      now: 1,
      setup: setupResult(noTradePlan(["balanced POC chop"]), readerRead({ location: "near-poc", pressure: "balanced", lastPrice: 100 })),
    });

    expect(update.candidate).toBeNull();
    expect(update.events.map((event) => event.type)).toContain("radar-ignored");
    expect(memory.size()).toBe(0);
  });

  test("expires stale candidates only when explicit stale policy is passed", () => {
    const memory = createReaderRadarMemory();
    updateReaderRadar({
      memory,
      config: { mode: "shadow" },
      now: 1,
      setup: setupResult(noTradePlan(["reader is waiting"]), readerRead({ location: "value-low", pressure: "balanced", lastPrice: 101 })),
    });

    const withoutPolicy = updateReaderRadar({
      memory,
      config: { mode: "shadow" },
      now: 1_001,
      setup: setupResult(noTradePlan(["other side"]), readerRead({ location: "value-high", pressure: "balanced", lastPrice: 109 })),
    });
    expect(withoutPolicy.events.map((event) => event.type)).not.toContain("radar-expired");

    const withPolicy = updateReaderRadar({
      memory,
      config: { mode: "shadow", maxStaleMs: 10 },
      now: 2_001,
      setup: setupResult(noTradePlan(["other side"]), readerRead({ location: "value-high", pressure: "balanced", lastPrice: 108 })),
    });
    expect(withPolicy.events.map((event) => event.type)).toContain("radar-expired");
  });

  test("execution mode promotes only an improving actionable candidate", () => {
    const memory = createReaderRadarMemory();
    updateReaderRadar({
      memory,
      config: { mode: "execute" },
      now: 1,
      setup: setupResult(reclaimPlan("ready-if-reclaim"), readerRead({ location: "value-low", pressure: "balanced", lastPrice: 101, poc: 105 })),
    });
    const promoted = updateReaderRadar({
      memory,
      config: { mode: "execute" },
      now: 2,
      setup: setupResult(reclaimPlan("ready-if-reclaim"), readerRead({ location: "value-low", pressure: "balanced", lastPrice: 102, poc: 105 })),
    });

    expect(promoted.promoted).toBe(true);
    expect(promoted.setup.plan.status).toBe("ready");
    expect(promoted.setup.planSource).toBe("memory-promoted");
    expect(promoted.events.map((event) => event.type)).toContain("radar-promoted");
  });

  test("execution mode holds a fresh ready plan until a later read confirms it", () => {
    const memory = createReaderRadarMemory();
    const born = updateReaderRadar({
      memory,
      config: { mode: "execute" },
      now: 1,
      setup: setupResult(reclaimPlan("ready"), readerRead({ location: "value-low", pressure: "balanced", lastPrice: 101, poc: 105 })),
    });
    const promoted = updateReaderRadar({
      memory,
      config: { mode: "execute" },
      now: 2,
      setup: setupResult(reclaimPlan("ready"), readerRead({ location: "value-low", pressure: "balanced", lastPrice: 102, poc: 105 })),
    });

    expect(born.promoted).toBe(false);
    expect(born.setup.plan.status).toBe("watch");
    expect(born.setup.planSource).toBe("memory-held");
    expect(promoted.promoted).toBe(true);
    expect(promoted.setup.plan.status).toBe("ready");
    expect(promoted.setup.planSource).toBe("memory-promoted");
  });

  test("execution mode kills candidates that deteriorate before improving", () => {
    const memory = createReaderRadarMemory();
    updateReaderRadar({
      memory,
      config: { mode: "execute" },
      now: 1,
      setup: setupResult(reclaimPlan("ready-if-reclaim"), readerRead({ location: "value-low", pressure: "balanced", lastPrice: 101, poc: 105 })),
    });
    updateReaderRadar({
      memory,
      config: { mode: "execute" },
      now: 2,
      setup: setupResult(reclaimPlan("ready-if-reclaim"), readerRead({ location: "value-low", pressure: "balanced", lastPrice: 100.5, poc: 105 })),
    });
    const restarted = updateReaderRadar({
      memory,
      config: { mode: "execute" },
      now: 3,
      setup: setupResult(reclaimPlan("ready-if-reclaim"), readerRead({ location: "value-low", pressure: "balanced", lastPrice: 102, poc: 105 })),
    });

    expect(restarted.promoted).toBe(false);
    expect(restarted.candidate?.readCount).toBe(1);
    expect(restarted.setup.plan.status).toBe("ready-if-reclaim");
    expect(restarted.events.map((event) => event.type)).not.toContain("radar-promoted");
  });

  test("execution mode keeps continuation pullback alive through middle-range retest", () => {
    const memory = createReaderRadarMemory();
    updateReaderRadar({
      memory,
      config: { mode: "execute" },
      now: 1,
      setup: setupResult(
        trendContinuationPlan("ready"),
        readerRead({
          location: "value-low",
          pressure: "buy-pressure",
          lastPrice: 101,
          poc: 105,
          continuation: true,
          localRangeLocation: "lower-edge",
        }),
      ),
    });
    const watched = updateReaderRadar({
      memory,
      config: { mode: "execute" },
      now: 2,
      setup: setupResult(
        trendContinuationPlan("watch"),
        readerRead({
          location: "value-low",
          pressure: "buy-pressure",
          lastPrice: 100.5,
          poc: 105,
          continuation: true,
          localRangeLocation: "middle",
        }),
      ),
    });

    expect(watched.candidate?.status).toBe("deteriorating");
    expect(watched.candidate?.invalidationEvidence).toEqual([
      "live read moved against the thesis",
      "price rotated away from POC before entry",
    ]);
    expect(watched.events.map((event) => event.type)).not.toContain("radar-killed");
  });

  test("execution mode kills continuation pullback when structure and current orderflow oppose it", () => {
    const memory = createReaderRadarMemory();
    updateReaderRadar({
      memory,
      config: { mode: "execute" },
      now: 1,
      setup: setupResult(
        trendContinuationPlan("ready"),
        readerRead({
          location: "value-low",
          pressure: "buy-pressure",
          lastPrice: 101,
          poc: 105,
          continuation: true,
          localRangeLocation: "lower-edge",
        }),
      ),
    });
    const killed = updateReaderRadar({
      memory,
      config: { mode: "execute" },
      now: 2,
      setup: setupResult(
        trendContinuationPlan("watch"),
        readerRead({
          location: "value-low",
          pressure: "sell-pressure",
          lastPrice: 100.5,
          poc: 105,
          continuation: true,
          localRangeLocation: "upper-edge",
          largestTradeSide: "sell",
        }),
      ),
    });

    expect(killed.candidate?.status).toBe("killed");
    expect(killed.candidate?.invalidationEvidence).toEqual([
      "live read moved against the thesis",
      "price rotated away from POC before entry",
      "long continuation reached the opposite local range edge",
    ]);
    expect(killed.candidate?.lastReason).toContain("live narrative invalidated");
    expect(killed.events.map((event) => event.type)).toContain("radar-killed");
  });

  test("execution mode can keep a deteriorating continuation alive when trap evidence repairs it", () => {
    const memory = createReaderRadarMemory();
    updateReaderRadar({
      memory,
      config: { mode: "execute" },
      now: 1,
      setup: setupResult(
        trendContinuationPlan("ready"),
        readerRead({ location: "value-low", pressure: "buy-pressure", lastPrice: 101, poc: 105, continuation: true }),
      ),
    });
    const repaired = updateReaderRadar({
      memory,
      config: { mode: "execute" },
      now: 2,
      setup: setupResult(
        trendContinuationPlan("watch"),
        readerRead({
          location: "value-low",
          pressure: "sell-pressure",
          lastPrice: 100.5,
          poc: 105,
          continuation: true,
          events: ["sell-absorption", "confirmed-absorption", "stalled-selling"],
          largestTradeSide: "sell",
          absorptionQuality: {
            quality: "trap-confirmed",
            side: "long",
            absorbedSide: "sell",
            reasons: ["test trap repair"],
            auctionLocation: "value-low",
            auctionMode: "failed-expansion",
            auctionPhase: "failed-expansion-fade",
            vpAuction: "inside-value",
            vpPoc: "poc-stable",
            vpValue: "value-stable",
            priceToPoc: "below-poc",
            targetMovesTowardPoc: true,
            evidence: {
              absorption: "confirmed",
              print: "local-standout",
              followThrough: "stalled",
              largestTradeSideMatchesAbsorbedSide: true,
            },
          },
        }),
      ),
    });
    const promoted = updateReaderRadar({
      memory,
      config: { mode: "execute" },
      now: 3,
      setup: setupResult(
        trendContinuationPlan("watch"),
        readerRead({ location: "value-low", pressure: "buy-pressure", lastPrice: 102, poc: 105, continuation: true }),
      ),
    });

    expect(repaired.candidate?.status).toBe("deteriorating");
    expect(repaired.candidate?.repairReads).toBe(1);
    expect(repaired.events.map((event) => event.type)).not.toContain("radar-killed");
    expect(repaired.events.map((event) => event.reason)).toContain("trend-continuation candidate has confirmed trap repair while reader keeps watching");
    expect(promoted.candidate?.adverseReads).toBe(1);
    expect(promoted.candidate?.repairReads).toBe(1);
    expect(promoted.promoted).toBe(true);
    expect(promoted.setup.plan.status).toBe("ready");
  });

  test("execution mode can promote adverse continuation after structural reclaim toward POC", () => {
    const memory = createReaderRadarMemory();
    updateReaderRadar({
      memory,
      config: { mode: "execute", tradeStyle: "trend-long-pullback-only" },
      now: 1,
      setup: setupResult(
        noTradePlan(["fresh read has a continuation candidate but no immediate entry"]),
        readerRead({
          location: "value-low",
          pressure: "buy-pressure",
          lastPrice: 101,
          poc: 105,
          continuation: true,
          largestTradeSide: "buy",
          localRangeLocation: "lower-edge",
        }),
      ),
    });
    updateReaderRadar({
      memory,
      config: { mode: "execute", tradeStyle: "trend-long-pullback-only" },
      now: 2,
      setup: setupResult(
        noTradePlan(["candidate retests lower before repair"]),
        readerRead({
          location: "value-low",
          pressure: "sell-pressure",
          lastPrice: 100.5,
          poc: 105,
          continuation: true,
          largestTradeSide: "sell",
          localRangeLocation: "lower-edge",
        }),
      ),
    });
    const reclaimed = updateReaderRadar({
      memory,
      config: { mode: "execute", tradeStyle: "trend-long-pullback-only" },
      now: 3,
      setup: setupResult(
        noTradePlan(["candidate reclaims with initiative buying toward POC"]),
        readerRead({
          location: "value-low",
          pressure: "buy-pressure",
          lastPrice: 102,
          poc: 105,
          continuation: true,
          largestTradeSide: "buy",
          localRangeLocation: "lower-edge",
        }),
      ),
    });
    const sustained = updateReaderRadar({
      memory,
      config: { mode: "execute", tradeStyle: "trend-long-pullback-only" },
      now: 4,
      setup: setupResult(
        noTradePlan(["candidate keeps improving toward POC"]),
        readerRead({
          location: "value-low",
          pressure: "buy-pressure",
          lastPrice: 103,
          poc: 105,
          continuation: true,
          largestTradeSide: "buy",
          localRangeLocation: "lower-edge",
        }),
      ),
    });

    expect(reclaimed.candidate?.adverseReads).toBe(1);
    expect(reclaimed.candidate?.pocRotation).toBe("toward-poc");
    expect(reclaimed.promoted).toBe(false);
    expect(reclaimed.events.map((event) => event.reason)).toContain("continuation pullback needs sustained favorable live reads");
    expect(sustained.promoted).toBe(true);
    expect(sustained.setup.plan.status).toBe("ready");
  });

  test("execution mode blocks structural adverse repair in range regime", () => {
    const memory = createReaderRadarMemory();
    updateReaderRadar({
      memory,
      config: { mode: "execute", tradeStyle: "trend-long-pullback-only" },
      now: 1,
      setup: setupResult(
        noTradePlan(["range continuation candidate needs live confirmation"]),
        readerRead({
          location: "value-low",
          pressure: "buy-pressure",
          lastPrice: 101,
          poc: 105,
          continuation: true,
          largestTradeSide: "buy",
          localRangeLocation: "lower-edge",
          regime: "range",
        }),
      ),
    });
    updateReaderRadar({
      memory,
      config: { mode: "execute", tradeStyle: "trend-long-pullback-only" },
      now: 2,
      setup: setupResult(
        noTradePlan(["range candidate retests lower"]),
        readerRead({
          location: "value-low",
          pressure: "sell-pressure",
          lastPrice: 100.5,
          poc: 105,
          continuation: true,
          largestTradeSide: "sell",
          localRangeLocation: "lower-edge",
          regime: "range",
        }),
      ),
    });
    const blocked = updateReaderRadar({
      memory,
      config: { mode: "execute", tradeStyle: "trend-long-pullback-only" },
      now: 3,
      setup: setupResult(
        noTradePlan(["range candidate reclaims but range regime keeps it suspect"]),
        readerRead({
          location: "value-low",
          pressure: "buy-pressure",
          lastPrice: 102,
          poc: 105,
          continuation: true,
          largestTradeSide: "buy",
          localRangeLocation: "lower-edge",
          regime: "range",
        }),
      ),
    });

    expect(blocked.candidate?.adverseReads).toBe(1);
    expect(blocked.candidate?.pocRotation).toBe("toward-poc");
    expect(blocked.promoted).toBe(false);
    expect(blocked.events.map((event) => event.reason)).toContain("candidate has unrepaired adverse live reads");
  });

  test("execution mode kills candidates moving away from POC before entry", () => {
    const memory = createReaderRadarMemory();
    updateReaderRadar({
      memory,
      config: { mode: "execute" },
      now: 1,
      setup: setupResult(resistancePlan("ready-if-reclaim"), readerRead({ location: "value-high", pressure: "balanced", lastPrice: 104, poc: 105 })),
    });
    const awayFromPoc = updateReaderRadar({
      memory,
      config: { mode: "execute" },
      now: 2,
      setup: setupResult(resistancePlan("ready-if-reclaim"), readerRead({ location: "value-high", pressure: "balanced", lastPrice: 103, poc: 105 })),
    });

    expect(awayFromPoc.candidate?.pocRotation).toBe("away-from-poc");
    expect(awayFromPoc.candidate?.status).toBe("killed");
    expect(awayFromPoc.events.map((event) => event.type)).toContain("radar-killed");
  });

  test("execution mode does not promote continuation when initiative flow is being absorbed", () => {
    const memory = createReaderRadarMemory();
    updateReaderRadar({
      memory,
      config: { mode: "execute" },
      now: 1,
      setup: setupResult(
        trendContinuationPlan("ready"),
        readerRead({ location: "value-low", pressure: "buy-pressure", lastPrice: 101, poc: 105, continuation: true }),
      ),
    });
    const absorbed = updateReaderRadar({
      memory,
      config: { mode: "execute" },
      now: 2,
      setup: setupResult(
        noTradePlan(["fresh read blocks continuation"]),
        readerRead({
          location: "value-low",
          pressure: "buy-pressure",
          lastPrice: 102,
          poc: 105,
          events: ["buy-absorption", "confirmed-absorption", "stalled-buying"],
          continuation: true,
        }),
      ),
    });

    expect(absorbed.promoted).toBe(false);
    expect(absorbed.setup.plan.status).toBe("no-trade");
    expect(absorbed.events.map((event) => event.type)).not.toContain("radar-promoted");
  });

  test("execution mode can promote absorption-blocked continuation after live absorption resolves", () => {
    const memory = createReaderRadarMemory();
    const born = updateReaderRadar({
      memory,
      config: { mode: "execute" },
      now: 1,
      setup: setupResult(
        noTradePlan([
          "continuation pullback is blocked because buying initiative is being absorbed",
          "a long pullback needs initiative buying, not stalled buying into absorption",
        ]),
        readerRead({
          location: "value-low",
          pressure: "buy-pressure",
          lastPrice: 101,
          poc: 105,
          events: ["buy-absorption", "confirmed-absorption", "stalled-buying"],
          continuation: true,
          largestTradeSide: "buy",
        }),
      ),
    });
    const confirmed = updateReaderRadar({
      memory,
      config: { mode: "execute" },
      now: 2,
      setup: setupResult(
        noTradePlan(["fresh read has no immediate plan, but absorption stopped contradicting continuation"]),
        readerRead({
          location: "value-low",
          pressure: "buy-pressure",
          lastPrice: 102,
          poc: 105,
          continuation: true,
          largestTradeSide: "buy",
        }),
      ),
    });
    expect(born.promoted).toBe(false);
    expect(born.candidate?.planSnapshot?.setupFamily).toBe("trend-continuation");
    expect(confirmed.promoted).toBe(true);
    expect(confirmed.candidate?.favorableReads).toBe(1);
    expect(confirmed.setup.plan.status).toBe("ready");
    expect(confirmed.setup.planSource).toBe("memory-promoted");
    expect(confirmed.events.map((event) => event.type)).toContain("radar-promoted");
  });

  test("execution mode can promote tracked continuation from generic no-trade once live structure improves", () => {
    const memory = createReaderRadarMemory();
    const born = updateReaderRadar({
      memory,
      config: { mode: "execute" },
      now: 1,
      setup: setupResult(
        noTradePlan(["fresh read has a continuation candidate but no immediate entry"]),
        readerRead({
          location: "value-low",
          pressure: "buy-pressure",
          lastPrice: 101,
          poc: 105,
          continuation: true,
          largestTradeSide: "buy",
          localRangeLocation: "lower-edge",
        }),
      ),
    });
    const confirmed = updateReaderRadar({
      memory,
      config: { mode: "execute" },
      now: 2,
      setup: setupResult(
        noTradePlan(["fresh read still has no immediate plan, but continuation is improving"]),
        readerRead({
          location: "value-low",
          pressure: "buy-pressure",
          lastPrice: 102,
          poc: 105,
          continuation: true,
          largestTradeSide: "buy",
          localRangeLocation: "lower-edge",
        }),
      ),
    });

    expect(born.promoted).toBe(false);
    expect(born.candidate?.planSnapshot?.setupFamily).toBe("trend-continuation");
    expect(confirmed.promoted).toBe(true);
    expect(confirmed.setup.plan.status).toBe("ready");
    expect(confirmed.setup.planSource).toBe("memory-promoted");
  });

  test("execution mode retires a promoted continuation thesis after deterioration", () => {
    const memory = createReaderRadarMemory();
    updateReaderRadar({
      memory,
      config: { mode: "execute", tradeStyle: "trend-long-pullback-only" },
      now: 1,
      setup: setupResult(
        noTradePlan(["fresh read has a continuation candidate but no immediate entry"]),
        readerRead({
          location: "value-low",
          pressure: "buy-pressure",
          lastPrice: 101,
          poc: 105,
          continuation: true,
          largestTradeSide: "buy",
          localRangeLocation: "lower-edge",
        }),
      ),
    });
    const improved = updateReaderRadar({
      memory,
      config: { mode: "execute", tradeStyle: "trend-long-pullback-only" },
      now: 2,
      setup: setupResult(
        noTradePlan(["candidate improves into entry"]),
        readerRead({
          location: "value-low",
          pressure: "buy-pressure",
          lastPrice: 102,
          poc: 105,
          continuation: true,
          largestTradeSide: "buy",
          localRangeLocation: "lower-edge",
        }),
      ),
    });
    const promoted = updateReaderRadar({
      memory,
      config: { mode: "execute", tradeStyle: "trend-long-pullback-only" },
      now: 3,
      setup: setupResult(
        noTradePlan(["candidate sustains entry support"]),
        readerRead({
          location: "value-low",
          pressure: "buy-pressure",
          lastPrice: 103,
          poc: 105,
          continuation: true,
          largestTradeSide: "buy",
          localRangeLocation: "lower-edge",
        }),
      ),
    });
    const retired = updateReaderRadar({
      memory,
      config: { mode: "execute", tradeStyle: "trend-long-pullback-only" },
      now: 4,
      setup: setupResult(
        noTradePlan(["promoted thesis starts failing"]),
        readerRead({
          location: "value-low",
          pressure: "sell-pressure",
          lastPrice: 102.5,
          poc: 105,
          continuation: true,
          largestTradeSide: "sell",
          localRangeLocation: "lower-edge",
        }),
      ),
    });
    const restarted = updateReaderRadar({
      memory,
      config: { mode: "execute", tradeStyle: "trend-long-pullback-only" },
      now: 5,
      setup: setupResult(
        noTradePlan(["same key improves later but must be a new watch"]),
        readerRead({
          location: "value-low",
          pressure: "buy-pressure",
          lastPrice: 103,
          poc: 105,
          continuation: true,
          largestTradeSide: "buy",
          localRangeLocation: "lower-edge",
        }),
      ),
    });

    expect(improved.promoted).toBe(false);
    expect(promoted.promoted).toBe(true);
    expect(retired.candidate?.status).toBe("killed");
    expect(retired.events.map((event) => event.reason)).toContain("promoted continuation thesis deteriorated after entry");
    expect(restarted.promoted).toBe(false);
    expect(restarted.candidate?.readCount).toBe(1);
  });

  test("execution mode blocks short continuation promotion in long-pullback-only experiments", () => {
    const memory = createReaderRadarMemory();
    updateReaderRadar({
      memory,
      config: { mode: "execute", tradeStyle: "trend-long-pullback-only" },
      now: 1,
      setup: setupResult(
        noTradePlan(["fresh read has a short continuation candidate but no immediate entry"]),
        readerRead({
          location: "value-high",
          pressure: "sell-pressure",
          lastPrice: 104,
          poc: 100,
          continuation: true,
          continuationSide: "short",
          largestTradeSide: "sell",
          localRangeLocation: "upper-edge",
        }),
      ),
    });
    const blocked = updateReaderRadar({
      memory,
      config: { mode: "execute", tradeStyle: "trend-long-pullback-only" },
      now: 2,
      setup: setupResult(
        noTradePlan(["short continuation is improving but this experiment is long-only"]),
        readerRead({
          location: "value-high",
          pressure: "sell-pressure",
          lastPrice: 103,
          poc: 100,
          continuation: true,
          continuationSide: "short",
          largestTradeSide: "sell",
          localRangeLocation: "upper-edge",
        }),
      ),
    });

    expect(blocked.candidate?.status).toBe("improving");
    expect(blocked.promoted).toBe(false);
    expect(blocked.events.map((event) => event.reason)).toContain("reader radar trend-long-pullback-only blocks trend-continuation/short candidate");
  });

  test("execution mode keeps continuation radar memory when no-trade becomes watch", () => {
    const memory = createReaderRadarMemory();
    updateReaderRadar({
      memory,
      config: { mode: "execute" },
      now: 1,
      setup: setupResult(
        noTradePlan([
          "continuation pullback is blocked because buying initiative is being absorbed",
          "a long pullback needs initiative buying, not stalled buying into absorption",
        ]),
        readerRead({
          location: "value-low",
          pressure: "buy-pressure",
          lastPrice: 101,
          poc: 105,
          events: ["buy-absorption", "confirmed-absorption", "stalled-buying"],
          continuation: true,
          largestTradeSide: "buy",
          localRangeLocation: "middle",
        }),
      ),
    });
    const watch = updateReaderRadar({
      memory,
      config: { mode: "execute" },
      now: 2,
      setup: setupResult(
        trendContinuationPlan("watch"),
        readerRead({
          location: "value-low",
          pressure: "buy-pressure",
          lastPrice: 102,
          poc: 105,
          continuation: true,
          largestTradeSide: "buy",
          localRangeLocation: "middle",
        }),
      ),
    });
    const sustained = updateReaderRadar({
      memory,
      config: { mode: "execute" },
      now: 3,
      setup: setupResult(
        trendContinuationPlan("watch"),
        readerRead({
          location: "value-low",
          pressure: "buy-pressure",
          lastPrice: 103,
          poc: 105,
          continuation: true,
          largestTradeSide: "buy",
          localRangeLocation: "middle",
        }),
      ),
    });

    expect(watch.candidate?.readCount).toBe(2);
    expect(watch.promoted).toBe(true);
    expect(watch.setup.plan.status).toBe("ready");
    expect(watch.events.map((event) => event.type)).toContain("radar-promoted");
  });

  test("execution mode can promote a middle-range continuation only after live improvement", () => {
    const memory = createReaderRadarMemory();
    updateReaderRadar({
      memory,
      config: { mode: "execute" },
      now: 1,
      setup: setupResult(
        noTradePlan([
          "continuation pullback is blocked because buying initiative is being absorbed",
          "a long pullback needs initiative buying, not stalled buying into absorption",
        ]),
        readerRead({
          location: "value-low",
          pressure: "buy-pressure",
          lastPrice: 101,
          poc: 105,
          events: ["buy-absorption", "confirmed-absorption", "stalled-buying"],
          continuation: true,
          largestTradeSide: "buy",
          localRangeLocation: "lower-edge",
        }),
      ),
    });
    const middleRange = updateReaderRadar({
      memory,
      config: { mode: "execute" },
      now: 2,
      setup: setupResult(
        noTradePlan(["fresh read has no immediate plan, but absorption stopped contradicting continuation"]),
        readerRead({
          location: "value-low",
          pressure: "buy-pressure",
          lastPrice: 102,
          poc: 105,
          continuation: true,
          largestTradeSide: "buy",
          localRangeLocation: "middle",
        }),
      ),
    });
    expect(middleRange.candidate?.status).toBe("promoted");
    expect(middleRange.promoted).toBe(true);
    expect(middleRange.setup.plan.status).toBe("ready");
    expect(middleRange.events.map((event) => event.type)).toContain("radar-promoted");
  });

  test("execution mode blocks middle-range continuation with unresolved invalidation evidence", () => {
    const memory = createReaderRadarMemory();
    updateReaderRadar({
      memory,
      config: { mode: "execute", tradeStyle: "trend-long-pullback-only" },
      now: 1,
      setup: setupResult(
        noTradePlan(["fresh read has a continuation candidate"]),
        readerRead({
          location: "value-low",
          pressure: "buy-pressure",
          lastPrice: 101,
          poc: 105,
          continuation: true,
          largestTradeSide: "buy",
          localRangeLocation: "middle",
          regime: "trend-down",
        }),
      ),
    });
    updateReaderRadar({
      memory,
      config: { mode: "execute", tradeStyle: "trend-long-pullback-only" },
      now: 2,
      setup: setupResult(
        noTradePlan(["candidate rotates away from POC before entry"]),
        readerRead({
          location: "value-low",
          pressure: "buy-pressure",
          lastPrice: 100.5,
          poc: 105,
          continuation: true,
          largestTradeSide: "buy",
          localRangeLocation: "middle",
          regime: "trend-down",
        }),
      ),
    });
    const blocked = updateReaderRadar({
      memory,
      config: { mode: "execute", tradeStyle: "trend-long-pullback-only" },
      now: 3,
      setup: setupResult(
        noTradePlan(["middle-range candidate improves again"]),
        readerRead({
          location: "value-low",
          pressure: "buy-pressure",
          lastPrice: 102,
          poc: 105,
          continuation: true,
          largestTradeSide: "buy",
          localRangeLocation: "middle",
          regime: "trend-down",
        }),
      ),
    });

    expect(blocked.candidate?.invalidationEvidence).toContain("price rotated away from POC before entry");
    expect(blocked.promoted).toBe(false);
    expect(blocked.events.map((event) => event.reason)).toContain("middle-range continuation has unresolved invalidation evidence");
  });

  test("execution mode blocks middle-range continuation in range regime", () => {
    const memory = createReaderRadarMemory();
    updateReaderRadar({
      memory,
      config: { mode: "execute", tradeStyle: "trend-long-pullback-only" },
      now: 1,
      setup: setupResult(
        noTradePlan(["range middle continuation needs stronger location"]),
        readerRead({
          location: "value-low",
          pressure: "buy-pressure",
          lastPrice: 101,
          poc: 105,
          continuation: true,
          largestTradeSide: "buy",
          localRangeLocation: "middle",
          regime: "range",
        }),
      ),
    });
    const blocked = updateReaderRadar({
      memory,
      config: { mode: "execute", tradeStyle: "trend-long-pullback-only" },
      now: 2,
      setup: setupResult(
        noTradePlan(["range middle continuation improved but is still not at an edge"]),
        readerRead({
          location: "value-low",
          pressure: "buy-pressure",
          lastPrice: 102,
          poc: 105,
          continuation: true,
          largestTradeSide: "buy",
          localRangeLocation: "middle",
          regime: "range",
        }),
      ),
    });

    expect(blocked.candidate?.status).toBe("improving");
    expect(blocked.promoted).toBe(false);
    expect(blocked.events.map((event) => event.reason)).toContain("continuation pullback needs sustained favorable live reads");
  });

  test("execution mode still blocks continuation promotion at the opposite local range edge", () => {
    const memory = createReaderRadarMemory();
    updateReaderRadar({
      memory,
      config: { mode: "execute" },
      now: 1,
      setup: setupResult(
        noTradePlan([
          "continuation pullback is blocked because buying initiative is being absorbed",
          "a long pullback needs initiative buying, not stalled buying into absorption",
        ]),
        readerRead({
          location: "value-low",
          pressure: "buy-pressure",
          lastPrice: 101,
          poc: 105,
          events: ["buy-absorption", "confirmed-absorption", "stalled-buying"],
          continuation: true,
          largestTradeSide: "buy",
          localRangeLocation: "lower-edge",
        }),
      ),
    });
    const upperEdge = updateReaderRadar({
      memory,
      config: { mode: "execute" },
      now: 2,
      setup: setupResult(
        noTradePlan(["fresh read has no immediate plan, but absorption stopped contradicting continuation"]),
        readerRead({
          location: "value-low",
          pressure: "buy-pressure",
          lastPrice: 102,
          poc: 105,
          continuation: true,
          largestTradeSide: "buy",
          localRangeLocation: "upper-edge",
        }),
      ),
    });

    expect(upperEdge.candidate?.status).toBe("improving");
    expect(upperEdge.promoted).toBe(false);
    expect(upperEdge.setup.plan.status).toBe("no-trade");
    expect(upperEdge.events.map((event) => event.type)).not.toContain("radar-promoted");
  });

  test("execution mode blocks sustained continuation when live price improves without POC rotation evidence", () => {
    const memory = createReaderRadarMemory();
    updateReaderRadar({
      memory,
      config: { mode: "execute" },
      now: 1,
      setup: setupResult(
        noTradePlan([
          "continuation pullback is blocked because buying initiative is being absorbed",
          "a long pullback needs initiative buying, not stalled buying into absorption",
        ]),
        readerRead({
          location: "value-low",
          pressure: "buy-pressure",
          lastPrice: 101,
          poc: 105,
          events: ["buy-absorption", "confirmed-absorption", "stalled-buying"],
          continuation: true,
          largestTradeSide: "buy",
        }),
      ),
    });
    updateReaderRadar({
      memory,
      config: { mode: "execute" },
      now: 2,
      setup: setupResult(
        noTradePlan(["fresh read has no immediate plan, but continuation is improving without POC evidence"]),
        readerRead({
          location: "value-low",
          pressure: "buy-pressure",
          lastPrice: 102,
          poc: null,
          continuation: true,
          largestTradeSide: "buy",
        }),
      ),
    });
    const awayFromPoc = updateReaderRadar({
      memory,
      config: { mode: "execute" },
      now: 3,
      setup: setupResult(
        noTradePlan(["fresh read has no immediate plan, but continuation is still improving without POC evidence"]),
        readerRead({
          location: "value-low",
          pressure: "buy-pressure",
          lastPrice: 103,
          poc: null,
          continuation: true,
          largestTradeSide: "buy",
        }),
      ),
    });

    const tracked = memory.snapshot()[0]?.value;
    expect(tracked?.favorableReads).toBe(2);
    expect(tracked?.pocRotation).toBe("no-poc");
    expect(awayFromPoc.promoted).toBe(false);
    expect(awayFromPoc.events.map((event) => event.type)).not.toContain("radar-promoted");
  });

  test("execution mode blocks continuation-pullback support reclaim in range even when live evidence improves", () => {
    const memory = createReaderRadarMemory();
    updateReaderRadar({
      memory,
      config: { mode: "execute" },
      now: 1,
      setup: setupResult(
        noTradePlan([
          "continuation pullback is blocked because buying initiative is being absorbed",
          "a long pullback needs initiative buying, not stalled buying into absorption",
        ]),
        readerRead({
          location: "value-low",
          pressure: "buy-pressure",
          lastPrice: 101,
          poc: 105,
          events: ["buy-absorption", "confirmed-absorption", "stalled-buying"],
          continuation: true,
          largestTradeSide: "buy",
          regime: "range",
        }),
      ),
    });
    updateReaderRadar({
      memory,
      config: { mode: "execute" },
      now: 2,
      setup: setupResult(
        noTradePlan(["range regime continuation is improving with live evidence"]),
        readerRead({
          location: "value-low",
          pressure: "buy-pressure",
          lastPrice: 102,
          poc: 105,
          continuation: true,
          largestTradeSide: "buy",
          regime: "range",
        }),
      ),
    });
    const rangeContinuation = updateReaderRadar({
      memory,
      config: { mode: "execute" },
      now: 3,
      setup: setupResult(
        noTradePlan(["range regime continuation keeps improving with live evidence"]),
        readerRead({
          location: "value-low",
          pressure: "buy-pressure",
          lastPrice: 103,
          poc: 105,
          continuation: true,
          largestTradeSide: "buy",
          regime: "range",
        }),
      ),
    });

    expect(memory.snapshot()[0]?.value.favorableReads).toBe(2);
    expect(rangeContinuation.promoted).toBe(false);
    expect(rangeContinuation.events.map((event) => event.reason)).toContain("long continuation support reclaim needs downside expansion regime");
  });

  test("execution mode does not promote stale continuation when the current narrative turns neutral", () => {
    const memory = createReaderRadarMemory();
    updateReaderRadar({
      memory,
      config: { mode: "execute" },
      now: 1,
      setup: setupResult(
        trendContinuationPlan("ready"),
        readerRead({ location: "value-low", pressure: "buy-pressure", lastPrice: 101, poc: 105, continuation: true }),
      ),
    });
    const stale = updateReaderRadar({
      memory,
      config: { mode: "execute" },
      now: 2,
      setup: setupResult(
        noTradePlan(["current reader is neutral"]),
        readerRead({ location: "value-low", pressure: "buy-pressure", lastPrice: 102, poc: 105 }),
      ),
    });

    expect(stale.promoted).toBe(false);
    expect(stale.setup.plan.status).toBe("no-trade");
    expect(stale.events.map((event) => event.type)).not.toContain("radar-promoted");
  });

  test("execution mode blocks neutral tracked long continuation while value is still expanding up", () => {
    const memory = createReaderRadarMemory();
    updateReaderRadar({
      memory,
      config: { mode: "execute", tradeStyle: "trend-long-pullback-only" },
      now: 1,
      setup: setupResult(
        noTradePlan(["fresh read has a continuation candidate"]),
        readerRead({
          location: "value-low",
          pressure: "buy-pressure",
          lastPrice: 101,
          poc: 105,
          continuation: true,
          largestTradeSide: "buy",
          localRangeLocation: "lower-edge",
        }),
      ),
    });
    updateReaderRadar({
      memory,
      config: { mode: "execute", tradeStyle: "trend-long-pullback-only" },
      now: 2,
      setup: setupResult(
        noTradePlan(["neutral read improves the tracked candidate"]),
        readerRead({
          location: "near-poc",
          pressure: "buy-pressure",
          lastPrice: 102,
          poc: 105,
          largestTradeSide: "buy",
          localRangeLocation: "lower-edge",
          vpValue: "value-expanding-up",
          initiativeConviction: "overwhelming",
        }),
      ),
    });
    const blocked = updateReaderRadar({
      memory,
      config: { mode: "execute", tradeStyle: "trend-long-pullback-only" },
      now: 3,
      setup: setupResult(
        noTradePlan(["neutral read keeps improving while value expands"]),
        readerRead({
          location: "near-poc",
          pressure: "buy-pressure",
          lastPrice: 103,
          poc: 105,
          largestTradeSide: "buy",
          localRangeLocation: "lower-edge",
          vpValue: "value-expanding-up",
          initiativeConviction: "overwhelming",
        }),
      ),
    });

    expect(blocked.candidate?.favorableReads).toBeGreaterThan(0);
    expect(blocked.promoted).toBe(false);
    expect(blocked.events.map((event) => event.reason)).toContain("neutral long continuation blocked while value is still expanding up");
  });

  test("execution mode blocks tracked long continuation after rotating into POC resistance", () => {
    const memory = createReaderRadarMemory();
    updateReaderRadar({
      memory,
      config: { mode: "execute", tradeStyle: "trend-long-pullback-only" },
      now: 1,
      setup: setupResult(
        noTradePlan(["fresh read has a continuation candidate"]),
        readerRead({
          location: "value-low",
          pressure: "buy-pressure",
          lastPrice: 101,
          poc: 105,
          continuation: true,
          largestTradeSide: "buy",
          localRangeLocation: "lower-edge",
        }),
      ),
    });
    updateReaderRadar({
      memory,
      config: { mode: "execute", tradeStyle: "trend-long-pullback-only" },
      now: 2,
      setup: setupResult(
        noTradePlan(["tracked candidate rotates toward POC"]),
        readerRead({
          location: "near-poc",
          levelKind: "resistance",
          pressure: "buy-pressure",
          lastPrice: 102,
          poc: 105,
          largestTradeSide: "buy",
          localRangeLocation: "middle",
          vpValue: "value-stable",
          initiativeConviction: "overwhelming",
        }),
      ),
    });
    const blocked = updateReaderRadar({
      memory,
      config: { mode: "execute", tradeStyle: "trend-long-pullback-only" },
      now: 3,
      setup: setupResult(
        noTradePlan(["tracked candidate reaches POC resistance"]),
        readerRead({
          location: "near-poc",
          levelKind: "resistance",
          pressure: "buy-pressure",
          lastPrice: 103,
          poc: 105,
          largestTradeSide: "buy",
          localRangeLocation: "middle",
          vpValue: "value-stable",
          initiativeConviction: "overwhelming",
        }),
      ),
    });

    expect(blocked.candidate?.favorableReads).toBeGreaterThan(0);
    expect(blocked.promoted).toBe(false);
    expect(blocked.events.map((event) => event.reason)).toContain("long continuation blocked after rotating into POC resistance");
  });

  test("execution mode blocks tracked long continuation at POC while value expands down", () => {
    const memory = createReaderRadarMemory();
    updateReaderRadar({
      memory,
      config: { mode: "execute", tradeStyle: "trend-long-pullback-only" },
      now: 1,
      setup: setupResult(
        noTradePlan(["fresh read has a continuation candidate"]),
        readerRead({
          location: "value-low",
          pressure: "buy-pressure",
          lastPrice: 101,
          poc: 105,
          continuation: true,
          largestTradeSide: "buy",
          localRangeLocation: "lower-edge",
        }),
      ),
    });
    updateReaderRadar({
      memory,
      config: { mode: "execute", tradeStyle: "trend-long-pullback-only" },
      now: 2,
      setup: setupResult(
        noTradePlan(["tracked candidate rotates toward POC"]),
        readerRead({
          location: "near-poc",
          pressure: "buy-pressure",
          lastPrice: 102,
          poc: 105,
          largestTradeSide: "buy",
          localRangeLocation: "middle",
          vpValue: "value-expanding-down",
          initiativeConviction: "overwhelming",
        }),
      ),
    });
    const blocked = updateReaderRadar({
      memory,
      config: { mode: "execute", tradeStyle: "trend-long-pullback-only" },
      now: 3,
      setup: setupResult(
        noTradePlan(["tracked candidate reaches POC while value expands down"]),
        readerRead({
          location: "near-poc",
          pressure: "buy-pressure",
          lastPrice: 103,
          poc: 105,
          largestTradeSide: "buy",
          localRangeLocation: "middle",
          vpValue: "value-expanding-down",
          initiativeConviction: "overwhelming",
        }),
      ),
    });

    expect(blocked.candidate?.favorableReads).toBeGreaterThan(0);
    expect(blocked.promoted).toBe(false);
    expect(blocked.events.map((event) => event.reason)).toContain("long continuation blocked after rotating into POC while value expands down");
  });

  test("execution mode blocks tracked long support reclaim outside downside expansion regime", () => {
    const memory = createReaderRadarMemory();
    updateReaderRadar({
      memory,
      config: { mode: "execute", tradeStyle: "trend-long-pullback-only" },
      now: 1,
      setup: setupResult(
        noTradePlan(["fresh read has a continuation candidate"]),
        readerRead({
          location: "value-low",
          pressure: "buy-pressure",
          lastPrice: 101,
          poc: 105,
          continuation: true,
          largestTradeSide: "buy",
          localRangeLocation: "lower-edge",
          regime: "range",
        }),
      ),
    });
    updateReaderRadar({
      memory,
      config: { mode: "execute", tradeStyle: "trend-long-pullback-only" },
      now: 2,
      setup: setupResult(
        noTradePlan(["tracked support reclaim improves"]),
        readerRead({
          location: "value-low",
          pressure: "buy-pressure",
          lastPrice: 102,
          poc: 105,
          continuation: true,
          largestTradeSide: "buy",
          localRangeLocation: "lower-edge",
          regime: "range",
        }),
      ),
    });
    const blocked = updateReaderRadar({
      memory,
      config: { mode: "execute", tradeStyle: "trend-long-pullback-only" },
      now: 3,
      setup: setupResult(
        noTradePlan(["tracked support reclaim keeps improving"]),
        readerRead({
          location: "value-low",
          pressure: "buy-pressure",
          lastPrice: 103,
          poc: 105,
          continuation: true,
          largestTradeSide: "buy",
          localRangeLocation: "lower-edge",
          regime: "range",
        }),
      ),
    });

    expect(blocked.candidate?.favorableReads).toBeGreaterThan(0);
    expect(blocked.promoted).toBe(false);
    expect(blocked.events.map((event) => event.reason)).toContain("long continuation support reclaim needs downside expansion regime");
  });

  test("execution mode allows tracked long support reclaim in downside expansion regime", () => {
    const memory = createReaderRadarMemory();
    updateReaderRadar({
      memory,
      config: { mode: "execute", tradeStyle: "trend-long-pullback-only" },
      now: 1,
      setup: setupResult(
        noTradePlan(["fresh read has a continuation candidate"]),
        readerRead({
          location: "value-low",
          pressure: "buy-pressure",
          lastPrice: 101,
          poc: 105,
          continuation: true,
          largestTradeSide: "buy",
          localRangeLocation: "lower-edge",
          regime: "trend-down",
        }),
      ),
    });
    updateReaderRadar({
      memory,
      config: { mode: "execute", tradeStyle: "trend-long-pullback-only" },
      now: 2,
      setup: setupResult(
        noTradePlan(["tracked support reclaim improves"]),
        readerRead({
          location: "value-low",
          pressure: "buy-pressure",
          lastPrice: 102,
          poc: 105,
          continuation: true,
          largestTradeSide: "buy",
          localRangeLocation: "lower-edge",
          regime: "trend-down",
        }),
      ),
    });
    const promoted = updateReaderRadar({
      memory,
      config: { mode: "execute", tradeStyle: "trend-long-pullback-only" },
      now: 3,
      setup: setupResult(
        noTradePlan(["tracked support reclaim keeps improving"]),
        readerRead({
          location: "value-low",
          pressure: "buy-pressure",
          lastPrice: 103,
          poc: 105,
          continuation: true,
          largestTradeSide: "buy",
          localRangeLocation: "lower-edge",
          regime: "trend-down",
        }),
      ),
    });

    expect(promoted.promoted).toBe(true);
    expect(promoted.events.map((event) => event.type)).toContain("radar-promoted");
  });

  test("execution mode blocks tracked continuation in stable POC chop", () => {
    const memory = createReaderRadarMemory();
    updateReaderRadar({
      memory,
      config: { mode: "execute", tradeStyle: "trend-long-pullback-only" },
      now: 1,
      setup: setupResult(
        noTradePlan(["fresh read has a continuation candidate"]),
        readerRead({
          location: "value-low",
          pressure: "buy-pressure",
          lastPrice: 101,
          poc: 105,
          continuation: true,
          largestTradeSide: "buy",
          localRangeLocation: "lower-edge",
        }),
      ),
    });
    updateReaderRadar({
      memory,
      config: { mode: "execute", tradeStyle: "trend-long-pullback-only" },
      now: 2,
      setup: setupResult(
        noTradePlan(["tracked candidate reaches stable POC chop"]),
        readerRead({
          location: "near-poc",
          pressure: "buy-pressure",
          lastPrice: 102,
          poc: 105,
          largestTradeSide: "buy",
          localRangeLocation: "middle",
          vpAuction: "poc-chop",
          vpPoc: "poc-stable",
          vpValue: "value-stable",
          initiativeConviction: "overwhelming",
        }),
      ),
    });
    const blocked = updateReaderRadar({
      memory,
      config: { mode: "execute", tradeStyle: "trend-long-pullback-only" },
      now: 3,
      setup: setupResult(
        noTradePlan(["tracked candidate remains in stable POC chop"]),
        readerRead({
          location: "near-poc",
          pressure: "buy-pressure",
          lastPrice: 103,
          poc: 105,
          largestTradeSide: "buy",
          localRangeLocation: "middle",
          vpAuction: "poc-chop",
          vpPoc: "poc-stable",
          vpValue: "value-stable",
          initiativeConviction: "overwhelming",
        }),
      ),
    });

    expect(blocked.candidate?.favorableReads).toBeGreaterThan(0);
    expect(blocked.promoted).toBe(false);
    expect(blocked.events.map((event) => event.reason)).toContain("continuation blocked in stable POC chop");
  });

  test("execution mode blocks tracked long continuation at POC support in range regime", () => {
    const memory = createReaderRadarMemory();
    updateReaderRadar({
      memory,
      config: { mode: "execute", tradeStyle: "trend-long-pullback-only" },
      now: 1,
      setup: setupResult(
        noTradePlan(["fresh read has a continuation candidate"]),
        readerRead({
          location: "value-low",
          pressure: "buy-pressure",
          lastPrice: 101,
          poc: 105,
          continuation: true,
          largestTradeSide: "buy",
          localRangeLocation: "lower-edge",
          regime: "range",
        }),
      ),
    });
    updateReaderRadar({
      memory,
      config: { mode: "execute", tradeStyle: "trend-long-pullback-only" },
      now: 2,
      setup: setupResult(
        noTradePlan(["tracked range candidate rotates toward POC support"]),
        readerRead({
          location: "near-poc",
          levelKind: "support",
          pressure: "buy-pressure",
          lastPrice: 102,
          poc: 105,
          continuation: true,
          largestTradeSide: "buy",
          localRangeLocation: "lower-edge",
          regime: "range",
          initiativeConviction: "overwhelming",
        }),
      ),
    });
    const blocked = updateReaderRadar({
      memory,
      config: { mode: "execute", tradeStyle: "trend-long-pullback-only" },
      now: 3,
      setup: setupResult(
        noTradePlan(["tracked range candidate keeps improving at POC support"]),
        readerRead({
          location: "near-poc",
          levelKind: "support",
          pressure: "buy-pressure",
          lastPrice: 103,
          poc: 105,
          continuation: true,
          largestTradeSide: "buy",
          localRangeLocation: "lower-edge",
          regime: "range",
          initiativeConviction: "overwhelming",
        }),
      ),
    });

    expect(blocked.candidate?.favorableReads).toBeGreaterThan(0);
    expect(blocked.promoted).toBe(false);
    expect(blocked.events.map((event) => event.reason)).toContain("long continuation blocked at POC support in range regime");
  });

  test("execution mode blocks neutral balanced continuation without overwhelming initiative", () => {
    const memory = createReaderRadarMemory();
    updateReaderRadar({
      memory,
      config: { mode: "execute", tradeStyle: "trend-long-pullback-only" },
      now: 1,
      setup: setupResult(
        noTradePlan(["fresh read has a continuation candidate"]),
        readerRead({
          location: "value-low",
          pressure: "buy-pressure",
          lastPrice: 101,
          poc: 105,
          continuation: true,
          largestTradeSide: "buy",
          localRangeLocation: "lower-edge",
        }),
      ),
    });
    updateReaderRadar({
      memory,
      config: { mode: "execute", tradeStyle: "trend-long-pullback-only" },
      now: 2,
      setup: setupResult(
        noTradePlan(["neutral balanced read improves the tracked candidate"]),
        readerRead({
          location: "near-poc",
          pressure: "buy-pressure",
          lastPrice: 102,
          poc: 105,
          auctionMode: "balanced-value",
          largestTradeSide: "buy",
          localRangeLocation: "lower-edge",
          vpValue: "value-stable",
          initiativeConviction: "decisive",
        }),
      ),
    });
    const blocked = updateReaderRadar({
      memory,
      config: { mode: "execute", tradeStyle: "trend-long-pullback-only" },
      now: 3,
      setup: setupResult(
        noTradePlan(["neutral balanced read keeps improving"]),
        readerRead({
          location: "near-poc",
          pressure: "buy-pressure",
          lastPrice: 103,
          poc: 105,
          auctionMode: "balanced-value",
          largestTradeSide: "buy",
          localRangeLocation: "lower-edge",
          vpValue: "value-stable",
          initiativeConviction: "decisive",
        }),
      ),
    });

    expect(blocked.candidate?.favorableReads).toBeGreaterThan(0);
    expect(blocked.promoted).toBe(false);
    expect(blocked.events.map((event) => event.reason)).toContain("neutral balanced continuation needs overwhelming initiative");
  });

  test("execution mode allows neutral balanced continuation with overwhelming initiative", () => {
    const memory = createReaderRadarMemory();
    updateReaderRadar({
      memory,
      config: { mode: "execute", tradeStyle: "trend-long-pullback-only" },
      now: 1,
      setup: setupResult(
        noTradePlan(["fresh read has a continuation candidate"]),
        readerRead({
          location: "value-low",
          pressure: "buy-pressure",
          lastPrice: 101,
          poc: 105,
          continuation: true,
          largestTradeSide: "buy",
          localRangeLocation: "lower-edge",
        }),
      ),
    });
    updateReaderRadar({
      memory,
      config: { mode: "execute", tradeStyle: "trend-long-pullback-only" },
      now: 2,
      setup: setupResult(
        noTradePlan(["neutral balanced read improves the tracked candidate"]),
        readerRead({
          location: "near-poc",
          pressure: "buy-pressure",
          lastPrice: 102,
          poc: 105,
          auctionMode: "balanced-value",
          largestTradeSide: "buy",
          localRangeLocation: "lower-edge",
          vpValue: "value-stable",
          initiativeConviction: "overwhelming",
        }),
      ),
    });
    const promoted = updateReaderRadar({
      memory,
      config: { mode: "execute", tradeStyle: "trend-long-pullback-only" },
      now: 3,
      setup: setupResult(
        noTradePlan(["neutral balanced read keeps improving with overwhelming initiative"]),
        readerRead({
          location: "near-poc",
          pressure: "buy-pressure",
          lastPrice: 103,
          poc: 105,
          auctionMode: "balanced-value",
          largestTradeSide: "buy",
          localRangeLocation: "lower-edge",
          vpValue: "value-stable",
          initiativeConviction: "overwhelming",
        }),
      ),
    });

    expect(promoted.candidate?.favorableReads).toBeGreaterThan(0);
    expect(promoted.promoted).toBe(true);
    expect(promoted.events.map((event) => event.type)).toContain("radar-promoted");
  });

  test("execution mode can promote tracked continuation even when current auction target revalidation disagrees", () => {
    const memory = createReaderRadarMemory();
    updateReaderRadar({
      memory,
      config: { mode: "execute" },
      now: 1,
      setup: setupResult(
        trendContinuationPlan("ready", { target: 110 }),
        readerRead({ location: "value-low", pressure: "buy-pressure", lastPrice: 101, poc: 105, continuation: true }),
      ),
    });
    const tracked = updateReaderRadar({
      memory,
      config: { mode: "execute" },
      now: 2,
      setup: setupResult(
        noTradePlan(["fresh read has no actionable plan"]),
        readerRead({
          location: "value-low",
          pressure: "buy-pressure",
          lastPrice: 102,
          poc: 105,
          continuation: true,
          auctionMode: "failed-expansion",
        }),
      ),
    });

    expect(tracked.promoted).toBe(true);
    expect(tracked.setup.plan.status).toBe("ready");
    expect(tracked.events.map((event) => event.type)).toContain("radar-promoted");
  });

  test("execution mode does not promote continuation when the largest print opposes the side", () => {
    const memory = createReaderRadarMemory();
    updateReaderRadar({
      memory,
      config: { mode: "execute" },
      now: 1,
      setup: setupResult(
        trendContinuationPlan("ready"),
        readerRead({
          location: "value-low",
          pressure: "buy-pressure",
          lastPrice: 101,
          poc: 105,
          continuation: true,
          largestTradeSide: "sell",
        }),
      ),
    });
    const opposedPrint = updateReaderRadar({
      memory,
      config: { mode: "execute" },
      now: 2,
      setup: setupResult(
        trendContinuationPlan("ready"),
        readerRead({
          location: "value-low",
          pressure: "buy-pressure",
          lastPrice: 102,
          poc: 105,
          continuation: true,
          largestTradeSide: "sell",
        }),
      ),
    });

    expect(opposedPrint.candidate?.status).toBe("improving");
    expect(opposedPrint.promoted).toBe(false);
    expect(opposedPrint.setup.plan.status).toBe("watch");
    expect(opposedPrint.events.map((event) => event.type)).not.toContain("radar-promoted");
  });

});

function setupResult(plan: ReaderTradePlan, read: LiveReaderRead): ReaderSetupResult {
  return {
    read,
    plan,
    setup: plan.status === "no-trade"
      ? null
      : {
          key: "BTC|5m",
          scope: null,
          asset: "BTC",
          interval: "5m",
          side: plan.side,
          status: plan.status === "ready" ? "ready" : plan.status === "ready-if-reclaim" ? "waiting-reclaim" : "watching",
          plan,
          createdAt: 1,
          updatedAt: 1,
          lastReadAt: 1,
          readCount: 1,
          lastReason: "test setup",
        },
    events: [],
    planSource: plan.status === "no-trade" ? "none" : "fresh-read",
  };
}

function noTradePlan(reasons: string[]): ReaderTradePlan {
  return {
    status: "no-trade",
    asset: "BTC",
    setupFamily: "none",
    confidence: 0,
    reasons,
  };
}

function reclaimPlan(status: "watch" | "ready-if-reclaim" | "ready"): ReaderTradePlan {
  return {
    status,
    asset: "BTC",
    setupFamily: "reversal-reclaim",
    side: "long",
    entryLow: 100,
    entryHigh: 102,
    stop: 99,
    target: 105,
    invalidation: "invalid below 99",
    confidence: 0,
    reasons: ["test actionable reclaim"],
  };
}

function resistancePlan(status: "watch" | "ready-if-reclaim" | "ready"): ReaderTradePlan {
  return {
    status,
    asset: "BTC",
    setupFamily: "reversal-reclaim",
    side: "short",
    entryLow: 103,
    entryHigh: 105,
    stop: 106,
    target: 95,
    invalidation: "invalid above 106",
    confidence: 0,
    reasons: ["test actionable reclaim"],
  };
}

function trendContinuationPlan(
  status: "watch" | "ready-if-reclaim" | "ready",
  input: { target?: number } = {},
): ReaderTradePlan {
  return {
    status,
    asset: "BTC",
    setupFamily: "trend-continuation",
    side: "long",
    entryLow: 100,
    entryHigh: 102,
    stop: 99,
    target: input.target ?? 105,
    invalidation: "invalid below 99",
    confidence: 0,
    reasons: ["test continuation pullback"],
  };
}

function readerRead(input: {
  location: LiveReaderRead["auction"]["location"];
  pressure: LiveReaderRead["orderflow"]["pressure"];
  lastPrice: number;
  poc?: number | null;
  levelKind?: "support" | "resistance";
  events?: string[];
  continuation?: boolean;
  continuationSide?: "long" | "short";
  auctionMode?: NonNullable<LiveReaderRead["auctionMode"]>["mode"];
  largestTradeSide?: "buy" | "sell";
  localRangeLocation?: NonNullable<LiveReaderRead["localRange"]>["location"];
  absorptionQuality?: LiveReaderRead["absorptionQuality"];
  regime?: NonNullable<LiveReaderRead["regime"]>["mode"];
  vpAuction?: NonNullable<LiveReaderRead["vpState"]>["auction"];
  vpPoc?: NonNullable<LiveReaderRead["vpState"]>["poc"];
  vpValue?: NonNullable<LiveReaderRead["vpState"]>["value"];
  initiativeConviction?: NonNullable<NonNullable<LiveReaderRead["orderflow"]>["initiative"]>["conviction"];
}): LiveReaderRead {
  return {
    asset: "BTC",
    stance: "wait",
    narrativeRead: input.continuation
      ? {
          intent: "continuation-pullback",
          direction: input.continuationSide ?? "long",
          participation: input.continuationSide === "short" ? "initiative-selling" : "initiative-buying",
          levelStory: input.continuationSide === "short" ? "accepting-above" : "accepting-below",
          reasons: ["test continuation pullback"],
          invalidation: "invalid below support",
          target: "target upper structure",
        }
      : undefined,
    narrative: "test read",
    invalidation: null,
    target: null,
    regime: input.regime
      ? {
          mode: input.regime,
          highVol: input.regime === "high-vol",
          rangePct: input.regime === "range" ? 1 : 0,
          driftPct: input.regime === "trend-up" ? 1 : input.regime === "trend-down" ? -1 : 0,
          directionalEfficiency: input.regime === "range" ? 0 : 1,
          reason: "test regime",
        }
      : undefined,
    auctionMode: input.auctionMode
      ? {
          mode: input.auctionMode,
          phase: "failed-expansion-fade",
          allowedDirection: "both",
          reasons: ["test auction mode"],
        }
      : undefined,
    absorptionQuality: input.absorptionQuality,
    vpState: input.vpValue || input.vpAuction || input.vpPoc
      ? {
          auction: input.vpAuction ?? "inside-value",
          poc: input.vpPoc ?? "poc-stable",
          value: input.vpValue ?? "value-stable",
          reasons: ["test vp state"],
        }
      : undefined,
    localRange: input.localRangeLocation
      ? {
          high: 110,
          low: 90,
          position: input.localRangeLocation === "lower-edge" ? 0.1 : input.localRangeLocation === "upper-edge" ? 0.9 : 0.5,
          location: input.localRangeLocation,
        }
      : undefined,
    auction: {
      asset: "BTC",
      interval: "5m",
      level: {
        price: input.location === "value-high" ? 110 : 100,
        kind: input.levelKind ?? (input.location === "value-high" ? "resistance" : "support"),
        touches: 2,
        firstTouchedAt: 1,
        lastTouchedAt: 1,
      },
      profile: input.poc === null
        ? null
        : {
            low: 90,
            high: 115,
            binSize: 2,
            poc: input.poc ?? 105,
            valueAreaLow: 95,
            valueAreaHigh: 110,
            bins: [],
          },
      location: input.location,
      bias: "wait",
      narrative: "auction read",
      invalidation: null,
      target: null,
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
      largestTrade: input.largestTradeSide
        ? {
            asset: "BTC",
            side: input.largestTradeSide,
            price: input.lastPrice,
            size: 4,
            time: 1,
            id: "largest",
          }
        : null,
      dominantSide: input.pressure === "buy-pressure" ? "buy" : input.pressure === "sell-pressure" ? "sell" : "none",
      pressure: input.pressure,
      initiative: input.initiativeConviction
        ? {
            side: input.pressure === "buy-pressure" ? "buy" : input.pressure === "sell-pressure" ? "sell" : "none",
            conviction: input.initiativeConviction,
            reasons: ["test initiative"],
          }
        : undefined,
      events: input.events ?? [],
      narrative: "orderflow read",
    },
  };
}
