import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { parseVolumeProfileStructure } from "../packages/strategy-lab/read-core/read/parse-volume-profile-structure";
import { extractMachineNativeVector } from "../packages/strategy-lab/reader/reader-structure/machine-native-vector";
import { scoreEdge } from "./agent-linear-brain";
import type { VolumeProfileStructure } from "../packages/strategy-lab/read-core/read/parse-volume-profile-structure";
import type { AgentWeights } from "./agent-linear-brain";

const BINANCE_WS = "wss://stream.binance.com:9443/ws/btcusdt@trade";
const PROFILE_INTERVAL_MS = 5 * 60 * 1000;
const ORDERFLOW_WINDOW_MS = 120_000;
const SCORE_THRESHOLD = 1.0;
const CSV_PATH = join(import.meta.dir, "..", ".data", "shadow-trades.csv");
const HTTP_PORT = 3001;
const MAX_SIGNALS = 20;

const LIVE_WEIGHTS: AgentWeights = {
  features: {
    distToNearestHVN_norm: -0.18,
    distToNearestLVN_norm: -0.10,
    distToPOC_norm: 2.08,
    distToValueHigh_norm: 0.65,
    distToValueLow_norm: 1.03,
    volumeGradient: -0.01,
    volumeROC: -0.88,
    profileSkewness: -0.72,
    volumeConcentration: 1.70,
    cvdVelocity_z: 0.50,
    cvdAcceleration_z: -0.01,
    deltaPerTick_z: 0.17,
    priceCvdCorrelation: 0.52,
    deltaAtPriceRatio: 1.03,
  },
  bias: 0.50,
};

type OrderflowBucket1s = {
  bucketMs: number;
  open: number;
  high: number;
  low: number;
  close: number;
  buyVolume: number;
  sellVolume: number;
  delta: number;
  tradeCount: number;
  largestTradeSize: number;
  largestTradePrice: number;
  largestTradeSide: "buy" | "sell";
  lastTradePrice: number;
};

type RollingCVD = {
  currentBucket: OrderflowBucket1s | null;
  buckets: OrderflowBucket1s[];
};

type RollingProfile = {
  currentTrades: { price: number; size: number; side: "buy" | "sell"; ms: number }[];
  currentStartMs: number;
  history: { startMs: number; endMs: number; trades: { price: number; size: number; side: "buy" | "sell"; ms: number }[] }[];
};

type Signal = {
  timestamp: string;
  side: string;
  price: number;
  score: number;
  distToPOC: number;
  volConc: number;
  distToValueLow: number;
};

const signals: Signal[] = [];

function createEmptyBucket(ms: number): OrderflowBucket1s {
  return {
    bucketMs: ms,
    open: 0, high: -Infinity, low: Infinity, close: 0,
    buyVolume: 0, sellVolume: 0, delta: 0, tradeCount: 0,
    largestTradeSize: 0, largestTradePrice: 0, largestTradeSide: "buy",
    lastTradePrice: 0,
  };
}

function rollCvd(cvd: RollingCVD, price: number, size: number, side: "buy" | "sell", ms: number): void {
  const bucketMs = Math.floor(ms / 1000) * 1000;

  if (!cvd.currentBucket || cvd.currentBucket.bucketMs !== bucketMs) {
    if (cvd.currentBucket) cvd.buckets.push(cvd.currentBucket);
    cvd.currentBucket = createEmptyBucket(bucketMs);
  }

  const b = cvd.currentBucket;
  if (b.tradeCount === 0) b.open = price;
  b.high = Math.max(b.high, price);
  b.low = Math.min(b.low, price);
  b.close = price;
  b.lastTradePrice = price;

  if (side === "buy") {
    b.buyVolume += size;
    b.delta += size;
  } else {
    b.sellVolume += size;
    b.delta -= size;
  }

  b.tradeCount++;
  if (size > b.largestTradeSize) {
    b.largestTradeSize = size;
    b.largestTradePrice = price;
    b.largestTradeSide = side;
  }

  const cutoff = ms - ORDERFLOW_WINDOW_MS;
  while (cvd.buckets.length > 0 && cvd.buckets[0].bucketMs < cutoff) {
    cvd.buckets.shift();
  }
}

function rollProfile(roll: RollingProfile, price: number, size: number, side: "buy" | "sell", ms: number): boolean {
  if (roll.currentStartMs === 0) roll.currentStartMs = Math.floor(ms / PROFILE_INTERVAL_MS) * PROFILE_INTERVAL_MS;

  roll.currentTrades.push({ price, size, side, ms });

  const currentBucketStart = Math.floor(ms / PROFILE_INTERVAL_MS) * PROFILE_INTERVAL_MS;
  if (currentBucketStart > roll.currentStartMs) {
    roll.history.push({ startMs: roll.currentStartMs, endMs: currentBucketStart, trades: roll.currentTrades });
    if (roll.history.length > 6) roll.history.shift();

    roll.currentTrades = [];
    roll.currentStartMs = currentBucketStart;
    return true;
  }
  return false;
}

function buildProfileFromHistory(history: RollingProfile["history"]): VolumeProfileStructure | null {
  if (history.length < 2) return null;

  const buckets: { startMs: number; endMs: number; binLow: number; binHigh: number; binMid: number; volume: number }[] = [];
  for (const h of history) {
    const priceMap = new Map<number, number>();
    for (const t of h.trades) {
      const bin = Math.round(t.price);
      priceMap.set(bin, (priceMap.get(bin) ?? 0) + t.size);
    }
    for (const [bin, vol] of priceMap) {
      buckets.push({ startMs: h.startMs, endMs: h.endMs, binLow: bin, binHigh: bin + 1, binMid: bin + 0.5, volume: vol });
    }
  }

  return parseVolumeProfileStructure({ buckets: buckets as any });
}

function buildOrderflowFromHistory(history: RollingProfile["history"]): OrderflowBucket1s[] {
  const buckets: OrderflowBucket1s[] = [];
  const bucketMap = new Map<number, OrderflowBucket1s>();

  for (const h of history) {
    for (const t of h.trades) {
      const bucketMs = Math.floor(t.ms / 1000) * 1000;
      let b = bucketMap.get(bucketMs);
      if (!b) {
        b = createEmptyBucket(bucketMs);
        bucketMap.set(bucketMs, b);
      }
      if (b.tradeCount === 0) b.open = t.price;
      b.high = Math.max(b.high, t.price);
      b.low = Math.min(b.low, t.price);
      b.close = t.price;
      b.lastTradePrice = t.price;
      if (t.side === "buy") { b.buyVolume += t.size; b.delta += t.size; }
      else { b.sellVolume += t.size; b.delta -= t.size; }
      b.tradeCount++;
      if (t.size > b.largestTradeSize) {
        b.largestTradeSize = t.size;
        b.largestTradePrice = t.price;
        b.largestTradeSide = t.side;
      }
    }
  }

  return Array.from(bucketMap.values()).sort((a, b) => a.bucketMs - b.bucketMs);
}

function writeCsvHeader() {
  mkdirSync(join(import.meta.dir, "..", ".data"), { recursive: true });
  appendFileSync(CSV_PATH, "timestamp,side,entry_price,score,distToPOC_norm,volumeConcentration,distToValueLow_norm\n");
}

function writeCsvRow(ts: string, side: string, price: number, score: number, vec: ReturnType<typeof extractMachineNativeVector>) {
  appendFileSync(CSV_PATH, `${ts},${side},${price.toFixed(2)},${score.toFixed(4)},${vec.spatial.distToPOC_norm.toFixed(4)},${vec.spatial.volumeConcentration.toFixed(4)},${vec.spatial.distToValueLow_norm.toFixed(4)}\n`);
}

function formatTime(ms: number): string {
  return new Date(ms).toISOString().replace("T", " ").replace(/\.\d+Z/, "");
}

async function main() {
  console.log("=== SHADOW TRADER ===");
  console.log(`Connecting to Binance BTC/USDT trade stream...`);
  console.log(`Score threshold: ${SCORE_THRESHOLD}`);
  console.log(`Profile interval: ${PROFILE_INTERVAL_MS / 1000}s`);
  console.log(`Output: ${CSV_PATH}`);
  console.log("");

  writeCsvHeader();

  Bun.serve({
    port: HTTP_PORT,
    fetch(req) {
      const url = new URL(req.url);
      if (url.pathname === "/api/signals") {
        return Response.json(signals, {
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET",
          },
        });
      }
      return new Response("Not Found", { status: 404 });
    },
  });
  console.log(`HTTP server listening on http://localhost:${HTTP_PORT}`);
  console.log(`GET /api/signals → last ${MAX_SIGNALS} signals as JSON`);
  console.log("");

  const cvd: RollingCVD = { currentBucket: null, buckets: [] };
  const profile: RollingProfile = { currentTrades: [], currentStartMs: 0, history: [] };

  let tradeCount = 0;
  let lastLogMs = 0;
  let lastProfileMs = 0;
  let lastPrice = 0;

  const ws = new WebSocket(BINANCE_WS);

  ws.onopen = () => {
    console.log(`[${formatTime(Date.now())}] Connected to Binance WebSocket`);
  };

  ws.onmessage = (event: MessageEvent) => {
    const data = JSON.parse(event.data as string);
    const price = parseFloat(data.p);
    const size = parseFloat(data.q);
    const side: "buy" | "sell" = data.m ? "sell" : "buy";
    const ms = data.T;

    lastPrice = price;
    tradeCount++;

    rollCvd(cvd, price, size, side, ms);
    const profileRolled = rollProfile(profile, price, size, side, ms);

    if (profileRolled && profile.history.length >= 3) {
      const structure = buildProfileFromHistory(profile.history);
      const orderflow = buildOrderflowFromHistory(profile.history);

      if (structure && orderflow.length > 0) {
        const vec = extractMachineNativeVector(price, structure, orderflow);
        const score = scoreEdge(vec, LIVE_WEIGHTS);
        const ts = formatTime(ms);

        lastProfileMs = ms;

        if (score > SCORE_THRESHOLD) {
          const signalSide = score > 0 ? "long" : "short";
          console.log(
            `[${ts}] Signal: ${signalSide.toUpperCase()} @ ${price.toFixed(2)} | Score: ${score.toFixed(2)} | distToPOC: ${vec.spatial.distToPOC_norm.toFixed(2)} | volConc: ${vec.spatial.volumeConcentration.toFixed(2)}`,
          );
          writeCsvRow(ts, signalSide, price, score, vec);
          signals.unshift({
            timestamp: ts,
            side: signalSide,
            price,
            score,
            distToPOC: vec.spatial.distToPOC_norm,
            volConc: vec.spatial.volumeConcentration,
            distToValueLow: vec.spatial.distToValueLow_norm,
          });
          if (signals.length > MAX_SIGNALS) signals.length = MAX_SIGNALS;
        }
      }
    }

    if (ms - lastLogMs > 10000) {
      const elapsed = ((ms - (lastLogMs || ms)) / 1000).toFixed(0);
      console.log(
        `[${formatTime(ms)}] trades: ${tradeCount} | price: ${price.toFixed(2)} | cvd buckets: ${cvd.buckets.length} | profile history: ${profile.history.length}`,
      );
      lastLogMs = ms;
    }
  };

  ws.onerror = (event: Event) => {
    console.error(`[${formatTime(Date.now())}] WebSocket error:`, event);
  };

  ws.onclose = (event: CloseEvent) => {
    console.log(`[${formatTime(Date.now())}] WebSocket closed: code=${event.code} reason=${event.reason}`);
  };

  process.on("SIGINT", () => {
    console.log(`\n[${formatTime(Date.now())}] Shutting down. Total trades: ${tradeCount}`);
    ws.close();
    process.exit(0);
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
