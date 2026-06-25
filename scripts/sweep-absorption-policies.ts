import { readOrderflowBuckets, intervalMs } from "../packages/market-data";
import { buildReaderHistoryReads } from "../packages/strategy-lab/reader/reader-history/build-reader-history-reads";
import { createReaderRadarMemory } from "../packages/strategy-lab/reader/reader-radar/create-reader-radar-memory";
import { createReaderResultState } from "../packages/strategy-lab/reader/reader-result/create-reader-result-state";
import { createReaderSetupMemory } from "../packages/strategy-lab/reader/reader-setup/create-reader-setup-memory";
import { createReaderNarrativeStateMemory } from "../packages/strategy-lab/reader/reader-narrative-state/create-reader-narrative-state-memory";
import { readReaderNarrative } from "../packages/strategy-lab/reader/reader-narrative/read-reader-narrative";
import { readMarketSetup } from "../packages/strategy-lab/reader/reader-setup/read-market-setup";
import { updateReaderNarrativeState } from "../packages/strategy-lab/reader/reader-narrative-state/update-reader-narrative-state";
import { updateReaderRadar } from "../packages/strategy-lab/reader/reader-radar/update-reader-radar";
import { updateReaderResult } from "../packages/strategy-lab/reader/reader-result/update-reader-result";
import { READER_ABSORPTION_POLICIES, type ReaderAbsorptionPolicy } from "../packages/strategy-lab/reader/reader-absorption-quality/types";
import { summarizeReaderEquity } from "../packages/strategy-lab/reader/reader-analysis/summarize-reader-equity";
import type { OrderflowBucket } from "../packages/market-data";
import type { OrderflowEvent } from "../packages/strategy-lab/read-core/orderflow/types";
import type { ReaderHistoryStep } from "../packages/strategy-lab/reader/reader-history/types";
import type { LiveReaderRead, LiveReaderStance } from "../packages/strategy-lab/reader/reader-live/types";
import type { ReaderNarrative } from "../packages/strategy-lab/reader/reader-narrative/types";
import type { ReaderRadarConfig } from "../packages/strategy-lab/reader/reader-radar/types";
import type { ReaderResultOutcome } from "../packages/strategy-lab/reader/reader-result/types";
import type { Candle, Side } from "../packages/strategy-lab/types";

type BucketEventMode = "split" | "aggregate";

const marketStoreRoot = arg("market-store-root", process.env.MARKET_STORE_ROOT ?? "market-store")!;
const asset = arg("asset", process.env.ASSET ?? "BTCUSDT")!.toUpperCase();
const interval = arg("interval", process.env.INTERVAL ?? "5m")!;
const candleIntervalMs = intervalMs(interval === "1h" ? "1h" : "5m");
const startMs = parseTimeArg("start", Date.parse("2025-05-01T00:00:00.000Z"));
const endMs = parseTimeArg("end", Date.parse("2025-09-01T00:00:00.000Z"));
const readIntervalMs = Number(arg("read-interval-ms", process.env.READ_INTERVAL_MS ?? "60000"));
const orderflowWindowMs = Number(arg("orderflow-window-ms", process.env.ORDERFLOW_WINDOW_MS ?? "300000"));
const setupTtlMs = Number(arg("setup-ttl-ms", process.env.SETUP_TTL_MS ?? "900000"));
const readerRadarMaxStaleMs = Number(arg("reader-radar-max-stale-ms", process.env.READER_RADAR_MAX_STALE_MS ?? "900000"));
const bucketEventMode = parseBucketEventMode(arg("bucket-event-mode", process.env.BUCKET_EVENT_MODE ?? "aggregate"));
const riskPct = Number(arg("risk-pct", process.env.RISK_PCT ?? "0.25"));
const policyArg = arg("policies", process.env.ABSORPTION_POLICIES);
const policies = parsePolicies(policyArg);

validateInput();

console.log("ABSORPTION POLICY SWEEP");
console.log(`asset=${asset} range=${iso(startMs)} -> ${iso(endMs)} interval=${interval} policies=${policies.join(",")}`);
console.log(`riskPct=${riskPct}`);
console.log("building_history=once");

const history = await loadHistory();
console.log(`history candles=${history.candles.length} reads=${history.steps.length} orderflow_events=${history.orderflowEventCount}`);
console.log("");

printHeader();
const results: SweepResult[] = [];
for (const policy of policies) {
  const result = evaluatePolicy({ policy, history });
  results.push(result);
  printResult(result);
}
console.log("");
console.log("ranked");
printHeader();
for (const result of rankedResults(results)) printResult(result);

function arg(name: string, fallback?: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function parseBucketEventMode(value: string | undefined): BucketEventMode {
  return value === "split" ? "split" : "aggregate";
}

function parsePolicies(value: string | undefined): ReaderAbsorptionPolicy[] {
  if (!value || value === "all") return READER_ABSORPTION_POLICIES;
  const requested = value.split(",").map((policy) => policy.trim()).filter(Boolean);
  const invalid = requested.filter((policy) => !READER_ABSORPTION_POLICIES.includes(policy as ReaderAbsorptionPolicy));
  if (invalid.length > 0) throw new Error(`unknown absorption policies: ${invalid.join(",")}`);
  return requested as ReaderAbsorptionPolicy[];
}

function parseTimeArg(name: string, fallback: number): number {
  const raw = arg(name);
  if (!raw) return fallback;
  const parsed = Date.parse(raw);
  if (Number.isFinite(parsed)) return parsed;
  const numeric = Number(raw);
  if (Number.isFinite(numeric)) return numeric;
  throw new Error(`--${name} must be an ISO timestamp or unix milliseconds`);
}

function validateInput(): void {
  if (endMs <= startMs) throw new Error("--end must be after --start");
  if (!Number.isFinite(readIntervalMs) || readIntervalMs <= 0) throw new Error("--read-interval-ms must be positive");
  if (!Number.isFinite(orderflowWindowMs) || orderflowWindowMs <= 0) throw new Error("--orderflow-window-ms must be positive");
  if (!Number.isFinite(setupTtlMs) || setupTtlMs <= 0) throw new Error("--setup-ttl-ms must be positive");
  if (!Number.isFinite(readerRadarMaxStaleMs) || readerRadarMaxStaleMs <= 0) throw new Error("--reader-radar-max-stale-ms must be positive");
  if (!Number.isFinite(riskPct) || riskPct <= 0) throw new Error("--risk-pct must be positive");
}

async function loadHistory(): Promise<{
  candles: Candle[];
  steps: ReaderHistoryStep[];
  orderflowEventCount: number;
}> {
  const candles: Candle[] = [];
  const steps: ReaderHistoryStep[] = [];
  let orderflowEventCount = 0;

  for (const chunk of dayChunks(startMs, endMs)) {
    const buckets = await readOrderflowBuckets({
      rootDir: marketStoreRoot,
      venue: "bybit",
      market: "trading",
      symbol: asset,
      startMs: chunk.start,
      endMs: chunk.end,
    });
    const chunkCandles = candlesFromBuckets({ buckets, candleIntervalMs });
    const orderflowEvents = orderflowEventsFromBuckets({ buckets, mode: bucketEventMode });
    const chunkSteps = buildReaderHistoryReads({
      asset,
      interval,
      candleIntervalMs,
      candles: chunkCandles,
      orderflowEvents,
      readIntervalMs,
      orderflowWindowMs,
      startAt: chunk.start,
      endAt: chunk.end,
    });

    candles.push(...chunkCandles);
    steps.push(...chunkSteps);
    orderflowEventCount += orderflowEvents.length;
    console.log(`chunk ${iso(chunk.start)} -> ${iso(chunk.end)} candles=${chunkCandles.length} reads=${chunkSteps.length} events=${orderflowEvents.length}`);
  }

  return {
    candles: candles.sort((left, right) => left.t - right.t),
    steps: steps.sort((left, right) => left.now - right.now),
    orderflowEventCount,
  };
}

function evaluatePolicy(input: {
  policy: ReaderAbsorptionPolicy;
  history: { candles: Candle[]; steps: ReaderHistoryStep[] };
}): {
  policy: ReaderAbsorptionPolicy;
  summary: SweepSummary;
  decision: string;
  long: SweepSummary;
  short: SweepSummary;
  range: SweepSummary;
  trendDown: SweepSummary;
  trendUp: SweepSummary;
} {
  const radarConfig: ReaderRadarConfig = {
    mode: "execute",
    maxStaleMs: readerRadarMaxStaleMs,
  };
  const outcomes = runPolicyReplay({
    steps: input.history.steps,
    policy: input.policy,
    radarConfig,
  });

  return {
    policy: input.policy,
    summary: summarizeOutcomes(outcomes),
    decision: decisionFor(summarizeOutcomes(outcomes)),
    long: summarizeOutcomes(outcomes.filter((outcome) => outcome.side === "long")),
    short: summarizeOutcomes(outcomes.filter((outcome) => outcome.side === "short")),
    range: summarizeOutcomes(outcomes.filter((outcome) => outcome.regime?.mode === "range")),
    trendDown: summarizeOutcomes(outcomes.filter((outcome) => outcome.regime?.mode === "trend-down")),
    trendUp: summarizeOutcomes(outcomes.filter((outcome) => outcome.regime?.mode === "trend-up")),
  };
}

type SweepResult = ReturnType<typeof evaluatePolicy>;

function runPolicyReplay(input: {
  steps: ReaderHistoryStep[];
  policy: ReaderAbsorptionPolicy;
  radarConfig: ReaderRadarConfig;
}): ReaderResultOutcome[] {
  const setupMemory = createReaderSetupMemory({ ttlMs: setupTtlMs });
  const radarMemory = createReaderRadarMemory();
  const narrativeMemory = createReaderNarrativeStateMemory();
  const resultState = createReaderResultState({ maxEvents: 1 });

  for (const step of input.steps) {
    const read = readForPolicy(step.read, input.policy);
    let setup = readMarketSetup({
      read,
      memory: setupMemory,
      now: step.now,
      config: {
        setupTtlMs,
        narrativeState: {
          memory: narrativeMemory,
          sessionMode: "utc-day",
        },
      },
    });
    const radarUpdate = updateReaderRadar({
      setup,
      memory: radarMemory,
      config: input.radarConfig,
      now: step.now,
    });
    setup = radarUpdate.setup;
    const resultUpdate = updateReaderResult({
      state: resultState,
      result: setup,
      now: step.now,
    });
    if (resultUpdate.closed) {
      updateReaderNarrativeState({
        memory: narrativeMemory,
        outcome: resultUpdate.closed,
        now: step.now,
      });
    }
  }

  return [...resultState.outcomes];
}

function readForPolicy(read: LiveReaderRead, policy: ReaderAbsorptionPolicy): LiveReaderRead {
  const narrativeRead = readReaderNarrative({
    auction: read.auction,
    orderflow: read.orderflow,
    lastClosedCandle: read.lastClosedCandle ?? null,
    absorptionQuality: read.absorptionQuality,
    absorptionPolicy: policy,
  });
  return {
    ...read,
    narrativeRead,
    stance: stanceFor(narrativeRead),
    narrative: narrativeFor(read.asset, narrativeRead),
    invalidation: narrativeRead.invalidation,
    target: narrativeRead.target,
  };
}

function stanceFor(narrative: ReaderNarrative): LiveReaderStance {
  if (narrative.intent === "wait") return narrative.levelStory === "inside-value" ? "avoid-balanced-auction" : "wait";
  if (narrative.direction === "long") {
    return narrative.intent === "reversal-reclaim" || narrative.intent === "breakout-continuation" || narrative.intent === "trend-continuation"
      ? "possible-long"
      : "watch-long-confirmation";
  }
  if (narrative.direction === "short") {
    return narrative.intent === "reversal-reclaim" || narrative.intent === "breakout-continuation" || narrative.intent === "trend-continuation"
      ? "possible-short"
      : "watch-short-confirmation";
  }
  return "wait";
}

function narrativeFor(asset: string, narrative: ReaderNarrative): string {
  return `${asset} narrative=${narrative.intent} direction=${narrative.direction} participation=${narrative.participation} level=${narrative.levelStory}. ${narrative.reasons.join(" ")}`;
}

type SweepSummary = {
  trades: number;
  wins: number;
  losses: number;
  totalR: number;
  averageR: number;
  maxDrawdownR: number;
  maxDrawdownAt: string;
  maxDrawdownFrom: string;
  minEquityR: number;
  minEquityAt: string;
  returnPct: number;
  maxDrawdownPct: number;
  minEquityPct: number;
};

function summarizeOutcomes(outcomes: ReaderResultOutcome[]): SweepSummary {
  const sorted = [...outcomes].sort((left, right) => left.exitAt - right.exitAt);
  const rValues = sorted.map((outcome) => outcome.r);
  const equity = summarizeReaderEquity(sorted, { riskPct });
  return {
    trades: sorted.length,
    wins: rValues.filter((r) => r > 0).length,
    losses: rValues.filter((r) => r < 0).length,
    totalR: equity.totalR,
    averageR: rValues.length === 0 ? 0 : round(sum(rValues) / rValues.length),
    maxDrawdownR: equity.maxDrawdownR,
    maxDrawdownAt: equity.maxDrawdownAt,
    maxDrawdownFrom: equity.maxDrawdownFrom,
    minEquityR: equity.minEquityR,
    minEquityAt: equity.minEquityAt,
    returnPct: equity.returnPct,
    maxDrawdownPct: equity.maxDrawdownPct,
    minEquityPct: equity.minEquityPct,
  };
}

function decisionFor(summary: SweepSummary): string {
  if (summary.trades < 100) return "COLLECT_MORE_DATA";
  if (summary.totalR <= 0 || summary.averageR <= 0) return "KILL";
  if (summary.maxDrawdownR <= -5) return "ADJUST";
  return "CONTINUE";
}

function rankedResults(results: SweepResult[]): SweepResult[] {
  return [...results].sort((left, right) => {
    return right.summary.totalR - left.summary.totalR
      || right.summary.averageR - left.summary.averageR
      || right.summary.trades - left.summary.trades;
  });
}

function printHeader(): void {
  console.log("policy,judgeable,wins,losses,totalR,avgR,maxDD,maxDDFrom,maxDDAt,minEquity,minEquityAt,returnPct,maxDDPct,minEquityPct,longR,shortR,rangeR,trendDownR,trendUpR,decision");
}

function printResult(result: SweepResult): void {
  console.log([
    result.policy,
    result.summary.trades,
    result.summary.wins,
    result.summary.losses,
    formatNumber(result.summary.totalR),
    formatNumber(result.summary.averageR),
    formatNumber(result.summary.maxDrawdownR),
    result.summary.maxDrawdownFrom,
    result.summary.maxDrawdownAt,
    formatNumber(result.summary.minEquityR),
    result.summary.minEquityAt,
    formatNumber(result.summary.returnPct),
    formatNumber(result.summary.maxDrawdownPct),
    formatNumber(result.summary.minEquityPct),
    formatNumber(result.long.totalR),
    formatNumber(result.short.totalR),
    formatNumber(result.range.totalR),
    formatNumber(result.trendDown.totalR),
    formatNumber(result.trendUp.totalR),
    result.decision,
  ].join(","));
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function round(value: number): number {
  return Number(value.toFixed(4));
}

function candlesFromBuckets(input: {
  buckets: OrderflowBucket[];
  candleIntervalMs: number;
}): Candle[] {
  const byStart = new Map<number, Candle>();
  for (const bucket of input.buckets) {
    const start = Math.floor(bucket.bucketMs / input.candleIntervalMs) * input.candleIntervalMs;
    const existing = byStart.get(start);
    const volume = bucket.buyVolume + bucket.sellVolume;
    if (!existing) {
      byStart.set(start, {
        t: start,
        o: bucket.open,
        h: bucket.high,
        l: bucket.low,
        c: bucket.close,
        v: volume,
      });
      continue;
    }
    existing.h = Math.max(existing.h, bucket.high);
    existing.l = Math.min(existing.l, bucket.low);
    existing.c = bucket.close;
    existing.v += volume;
  }
  return [...byStart.values()].sort((left, right) => left.t - right.t);
}

function orderflowEventsFromBuckets(input: {
  buckets: OrderflowBucket[];
  mode: BucketEventMode;
}): OrderflowEvent[] {
  const events: OrderflowEvent[] = [];
  for (const bucket of input.buckets) {
    events.push(...bucketTradeEvents({ bucket, mode: input.mode }));
  }
  return events.sort((left, right) => eventTime(left) - eventTime(right));
}

function bucketTradeEvents(input: {
  bucket: OrderflowBucket;
  mode: BucketEventMode;
}): OrderflowEvent[] {
  const events: OrderflowEvent[] = [];
  const largestSize = Math.max(0, input.bucket.largestTradeSize);
  const largestBuy = input.bucket.largestTradeSide === "buy" ? largestSize : 0;
  const largestSell = input.bucket.largestTradeSide === "sell" ? largestSize : 0;
  const buyRemainder = Math.max(0, input.bucket.buyVolume - largestBuy);
  const sellRemainder = Math.max(0, input.bucket.sellVolume - largestSell);
  const firstSide = input.bucket.delta >= 0 ? "buy" : "sell";

  if (buyRemainder > 0) {
    events.push(...bucketSideEvents({
      idPrefix: `${input.bucket.bucketMs}:buy`,
      side: "buy",
      totalSize: buyRemainder,
      maxChunkSize: largestSize,
      price: firstSide === "buy" ? input.bucket.open : input.bucket.close,
      time: input.bucket.bucketMs,
      mode: input.mode,
    }));
  }
  if (sellRemainder > 0) {
    events.push(...bucketSideEvents({
      idPrefix: `${input.bucket.bucketMs}:sell`,
      side: "sell",
      totalSize: sellRemainder,
      maxChunkSize: largestSize,
      price: firstSide === "sell" ? input.bucket.open : input.bucket.close,
      time: input.bucket.bucketMs,
      mode: input.mode,
    }));
  }
  if (largestSize > 0) {
    events.push(bucketTradeEvent({
      id: `${input.bucket.bucketMs}:largest`,
      side: input.bucket.largestTradeSide,
      size: largestSize,
      price: input.bucket.largestTradePrice || input.bucket.close,
      time: input.bucket.bucketMs,
    }));
  }
  return events;
}

function bucketSideEvents(input: {
  idPrefix: string;
  side: "buy" | "sell";
  totalSize: number;
  maxChunkSize: number;
  price: number;
  time: number;
  mode: BucketEventMode;
}): OrderflowEvent[] {
  if (input.mode === "aggregate") {
    return [bucketTradeEvent({
      id: `${input.idPrefix}:aggregate`,
      side: input.side,
      size: input.totalSize,
      price: input.price,
      time: input.time,
    })];
  }

  const targetChunkSize = input.maxChunkSize > 0 ? Math.max(input.maxChunkSize * 0.75, input.totalSize / 8) : input.totalSize;
  const chunks = Math.max(1, Math.min(8, Math.ceil(input.totalSize / targetChunkSize)));
  const size = input.totalSize / chunks;
  return Array.from({ length: chunks }, (_, index) => bucketTradeEvent({
    id: `${input.idPrefix}:${index}`,
    side: input.side,
    size,
    price: input.price,
    time: input.time,
  }));
}

function bucketTradeEvent(input: {
  id: string;
  side: "buy" | "sell";
  size: number;
  price: number;
  time: number;
}): OrderflowEvent {
  return {
    type: "trade",
    receivedAt: input.time,
    trade: {
      asset,
      side: input.side,
      price: input.price,
      size: input.size,
      time: input.time,
      id: input.id,
    },
  };
}

function eventTime(event: OrderflowEvent): number {
  return event.type === "trade" ? event.trade.time : event.bbo.time;
}

function dayChunks(start: number, end: number): Array<{ start: number; end: number }> {
  const chunks: Array<{ start: number; end: number }> = [];
  const cursor = new Date(start);
  cursor.setUTCHours(0, 0, 0, 0);

  while (cursor.getTime() < end) {
    const next = new Date(cursor);
    next.setUTCDate(next.getUTCDate() + 1);
    const chunkStart = Math.max(start, cursor.getTime());
    const chunkEnd = Math.min(end - 1, next.getTime() - 1);
    if (chunkEnd >= chunkStart) chunks.push({ start: chunkStart, end: chunkEnd });
    cursor.setTime(next.getTime());
  }
  return chunks;
}

function formatNumber(value: number): string {
  return Number.isFinite(value) ? value.toFixed(4).replace(/\.?0+$/, "") : "n/a";
}

function iso(time: number): string {
  return new Date(time).toISOString();
}


