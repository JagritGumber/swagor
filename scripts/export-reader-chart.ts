import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { readOrderflowEvents } from "../packages/market-data";
import type { OrderflowEvent } from "../packages/strategy-lab";

type Candle = {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
};

type TradeMarker = {
  at: number;
  side: "long" | "short";
  entry: number;
  stop: number;
  target: number;
};

type VolumeProfileBin = {
  low: number;
  high: number;
  mid: number;
  volume: number;
};

type VolumeProfile = {
  low: number;
  high: number;
  binSize: number;
  poc: number;
  valueAreaLow: number;
  valueAreaHigh: number;
  totalVolume: number;
  bins: VolumeProfileBin[];
};

function arg(name: string, fallback?: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

const asset = arg("asset", "BTCUSDT")!.toUpperCase();
const orderflowRoot = arg("orderflow-root", "orderflow-data")!;
const start = parseTime("start");
const end = parseTime("end");
const intervalMs = Number(arg("interval-ms", "300000"));
const out = arg("out", join("D:\\tmp", `${asset}-${new Date(start).toISOString().replace(/[:.]/g, "-")}.html`))!;
const marker = markerFromArgs();

validate();

const events = await readEvents(asset, start, end);
const candles = candlesFromTrades({ asset, events, intervalMs });
const profile = buildTradeVolumeProfile({ asset, events });
await mkdir(dirname(out), { recursive: true });
await writeFile(out, htmlFor({ asset, start, end, candles, marker, profile }), "utf8");

console.log(`wrote=${out}`);
console.log(`asset=${asset} window=${new Date(start).toISOString()} -> ${new Date(end).toISOString()} candles=${candles.length} trades=${events.filter((event) => event.type === "trade").length}`);
if (profile) {
  console.log(`profile poc=${profile.poc.toFixed(2)} val=${profile.valueAreaLow.toFixed(2)} vah=${profile.valueAreaHigh.toFixed(2)} totalVolume=${profile.totalVolume.toFixed(4)}`);
}

function parseTime(name: string): number {
  const raw = arg(name);
  if (!raw) throw new Error(`--${name} is required`);
  const parsed = Date.parse(raw);
  if (!Number.isFinite(parsed)) throw new Error(`--${name} must be an ISO timestamp`);
  return parsed;
}

function markerFromArgs(): TradeMarker | null {
  const entry = Number(arg("entry"));
  const stop = Number(arg("stop"));
  const target = Number(arg("target"));
  const side = arg("side");
  const atRaw = arg("entry-at");
  if (!Number.isFinite(entry) && !Number.isFinite(stop) && !Number.isFinite(target) && !side && !atRaw) return null;
  if (side !== "long" && side !== "short") throw new Error("--side must be long or short when marker args are used");
  if (!atRaw) throw new Error("--entry-at is required when marker args are used");
  const at = Date.parse(atRaw);
  if (!Number.isFinite(at)) throw new Error("--entry-at must be an ISO timestamp");
  if (!Number.isFinite(entry) || !Number.isFinite(stop) || !Number.isFinite(target)) {
    throw new Error("--entry, --stop, and --target are required marker prices");
  }
  return { at, side, entry, stop, target };
}

function validate(): void {
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) throw new Error("--end must be after --start");
  if (!Number.isFinite(intervalMs) || intervalMs <= 0) throw new Error("--interval-ms must be positive");
}

async function readEvents(symbol: string, from: number, to: number): Promise<OrderflowEvent[]> {
  const events: OrderflowEvent[] = [];
  for (const date of dateRange(from, to)) {
    const path = join(orderflowRoot, "bybit", "trading", symbol, `${date}.ndjson`);
    try {
      for (const event of await readOrderflowEvents(path)) events.push(event);
    } catch (error: unknown) {
      if (!isMissingFileError(error)) throw error;
    }
  }
  return events
    .filter((event) => eventTime(event) >= from && eventTime(event) <= to)
    .sort((left, right) => eventTime(left) - eventTime(right));
}

function candlesFromTrades(input: {
  asset: string;
  events: OrderflowEvent[];
  intervalMs: number;
}): Candle[] {
  const byStart = new Map<number, Candle>();
  for (const event of input.events) {
    if (event.type !== "trade" || event.trade.asset.toUpperCase() !== input.asset) continue;
    const startAt = Math.floor(event.trade.time / input.intervalMs) * input.intervalMs;
    const existing = byStart.get(startAt);
    if (!existing) {
      byStart.set(startAt, {
        t: startAt,
        o: event.trade.price,
        h: event.trade.price,
        l: event.trade.price,
        c: event.trade.price,
        v: event.trade.size,
      });
      continue;
    }
    existing.h = Math.max(existing.h, event.trade.price);
    existing.l = Math.min(existing.l, event.trade.price);
    existing.c = event.trade.price;
    existing.v += event.trade.size;
  }
  return [...byStart.values()].sort((left, right) => left.t - right.t);
}

function buildTradeVolumeProfile(input: {
  asset: string;
  events: OrderflowEvent[];
}): VolumeProfile | null {
  const trades = input.events
    .filter((event) => event.type === "trade" && event.trade.asset.toUpperCase() === input.asset)
    .map((event) => event.type === "trade" ? event.trade : null)
    .filter((trade) => trade !== null);
  if (trades.length === 0) return null;

  let low = Number.POSITIVE_INFINITY;
  let high = Number.NEGATIVE_INFINITY;
  for (const trade of trades) {
    low = Math.min(low, trade.price);
    high = Math.max(high, trade.price);
  }
  const range = high - low;
  const binCount = 80;
  const binSize = range <= 0 ? 1 : range / binCount;
  const bins = Array.from({ length: binCount }, (_, index) => ({
    low: low + index * binSize,
    high: low + (index + 1) * binSize,
    mid: low + (index + 0.5) * binSize,
    volume: 0,
  }));

  for (const trade of trades) {
    const index = Math.min(binCount - 1, Math.max(0, Math.floor((trade.price - low) / binSize)));
    bins[index]!.volume += trade.size;
  }

  const totalVolume = bins.reduce((sum, bin) => sum + bin.volume, 0);
  const pocIndex = bins.reduce((best, bin, index) => bin.volume > bins[best]!.volume ? index : best, 0);
  const valueArea = valueAreaFor({ bins, pocIndex, targetVolume: totalVolume * 0.7 });

  return {
    low,
    high,
    binSize,
    poc: bins[pocIndex]!.mid,
    valueAreaLow: bins[valueArea.low]!.low,
    valueAreaHigh: bins[valueArea.high]!.high,
    totalVolume,
    bins,
  };
}

function valueAreaFor(input: {
  bins: VolumeProfileBin[];
  pocIndex: number;
  targetVolume: number;
}): { low: number; high: number } {
  let low = input.pocIndex;
  let high = input.pocIndex;
  let volume = input.bins[input.pocIndex]!.volume;

  while (volume < input.targetVolume && (low > 0 || high < input.bins.length - 1)) {
    const lowerVolume = low > 0 ? input.bins[low - 1]!.volume : -1;
    const upperVolume = high < input.bins.length - 1 ? input.bins[high + 1]!.volume : -1;
    if (upperVolume >= lowerVolume) {
      high += 1;
      volume += input.bins[high]!.volume;
    } else {
      low -= 1;
      volume += input.bins[low]!.volume;
    }
  }

  return { low, high };
}

function htmlFor(input: {
  asset: string;
  start: number;
  end: number;
  candles: Candle[];
  marker: TradeMarker | null;
  profile: VolumeProfile | null;
}): string {
  const width = 1480;
  const height = 860;
  const pad = { left: 72, right: 292, top: 44, bottom: 146 };
  const chartHeight = 540;
  const volumeTop = pad.top + chartHeight + 28;
  const plotWidth = width - pad.left - pad.right;
  const prices = input.candles.flatMap((candle) => [candle.h, candle.l]);
  if (input.profile) prices.push(input.profile.low, input.profile.high, input.profile.poc, input.profile.valueAreaLow, input.profile.valueAreaHigh);
  if (input.marker) prices.push(input.marker.entry, input.marker.stop, input.marker.target);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const maxVolume = Math.max(1, ...input.candles.map((candle) => candle.v));
  const xFor = (time: number) => pad.left + ((time - input.start) / (input.end - input.start)) * plotWidth;
  const yFor = (price: number) => pad.top + ((maxPrice - price) / (maxPrice - minPrice || 1)) * chartHeight;
  const candleWidth = Math.max(3, Math.min(14, plotWidth / Math.max(1, input.candles.length) * 0.65));
  const candleSvg = input.candles.map((candle) => {
    const x = xFor(candle.t);
    const color = candle.c >= candle.o ? "#16a34a" : "#dc2626";
    const bodyTop = yFor(Math.max(candle.o, candle.c));
    const bodyBottom = yFor(Math.min(candle.o, candle.c));
    const bodyHeight = Math.max(1, bodyBottom - bodyTop);
    const volumeHeight = Math.max(1, (candle.v / maxVolume) * 78);
    return [
      `<line x1="${x.toFixed(2)}" y1="${yFor(candle.h).toFixed(2)}" x2="${x.toFixed(2)}" y2="${yFor(candle.l).toFixed(2)}" stroke="${color}" stroke-width="1"/>`,
      `<rect x="${(x - candleWidth / 2).toFixed(2)}" y="${bodyTop.toFixed(2)}" width="${candleWidth.toFixed(2)}" height="${bodyHeight.toFixed(2)}" fill="${color}" opacity="0.88"/>`,
      `<rect x="${(x - candleWidth / 2).toFixed(2)}" y="${(volumeTop + 82 - volumeHeight).toFixed(2)}" width="${candleWidth.toFixed(2)}" height="${volumeHeight.toFixed(2)}" fill="${color}" opacity="0.28"/>`,
    ].join("\n");
  }).join("\n");
  const markerSvg = input.marker ? markerSvgFor(input.marker, xFor, yFor, width, pad.right) : "";
  const profileSvg = input.profile ? profileSvgFor({
    profile: input.profile,
    yFor,
    x: width - pad.right + 28,
    maxWidth: pad.right - 72,
    chartRight: width - pad.right,
    chartLeft: pad.left,
  }) : "";
  const diagnosticSvg = diagnosticSvgFor({ marker: input.marker, profile: input.profile, x: pad.left, y: volumeTop + 112 });
  const grid = priceGrid(minPrice, maxPrice, yFor, width, pad);
  const timeAxis = timeAxisSvgFor({ start: input.start, end: input.end, xFor, top: pad.top, bottom: volumeTop + 88 });
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(input.asset)} ${new Date(input.start).toISOString()}</title>
  <style>
    body { margin: 0; background: #0f172a; color: #e5e7eb; font-family: Arial, sans-serif; }
    .wrap { padding: 20px; }
    h1 { font-size: 18px; margin: 0 0 4px; }
    p { margin: 0 0 16px; color: #9ca3af; }
    svg { background: #111827; border: 1px solid #273244; border-radius: 6px; }
    text { fill: #cbd5e1; font-size: 12px; }
    .small { font-size: 11px; fill: #9ca3af; }
    .strong { font-size: 12px; fill: #f8fafc; }
  </style>
</head>
<body>
  <div class="wrap">
    <h1>${escapeHtml(input.asset)} local replay chart</h1>
    <p>${new Date(input.start).toISOString()} to ${new Date(input.end).toISOString()} UTC</p>
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img">
      <rect x="${pad.left}" y="${pad.top}" width="${plotWidth}" height="${chartHeight}" fill="#0b1220"/>
      ${grid}
      ${timeAxis}
      ${profileSvg}
      ${candleSvg}
      ${markerSvg}
      <text x="${pad.left}" y="${volumeTop - 8}">volume</text>
      ${diagnosticSvg}
      <text x="${pad.left}" y="${height - 28}">${new Date(input.start).toISOString()}</text>
      <text x="${width - pad.right - 180}" y="${height - 28}">${new Date(input.end).toISOString()}</text>
    </svg>
  </div>
</body>
</html>`;
}

function timeAxisSvgFor(input: {
  start: number;
  end: number;
  xFor: (time: number) => number;
  top: number;
  bottom: number;
}): string {
  const windowMs = input.end - input.start;
  const targetTicks = windowMs <= 2 * 60 * 60 * 1000 ? 7 : windowMs <= 10 * 60 * 60 * 1000 ? 9 : 13;
  const rawStep = windowMs / Math.max(1, targetTicks - 1);
  const step = niceTimeStep(rawStep);
  const first = Math.ceil(input.start / step) * step;
  const lines: string[] = [];
  for (let time = first; time <= input.end; time += step) {
    const x = input.xFor(time);
    const label = utcTimeLabel(time);
    lines.push(`<line x1="${x.toFixed(2)}" y1="${input.top}" x2="${x.toFixed(2)}" y2="${input.bottom}" stroke="#1f2a3d" stroke-width="1"/>`);
    lines.push(`<text x="${(x - 18).toFixed(2)}" y="${input.bottom + 18}" class="small">${label}</text>`);
  }
  return lines.join("\n");
}

function niceTimeStep(rawMs: number): number {
  const steps = [
    5 * 60_000,
    10 * 60_000,
    15 * 60_000,
    30 * 60_000,
    60 * 60_000,
    2 * 60 * 60_000,
    4 * 60 * 60_000,
  ];
  return steps.find((step) => step >= rawMs) ?? 6 * 60 * 60_000;
}

function utcTimeLabel(time: number): string {
  return new Date(time).toISOString().slice(11, 16);
}

function profileSvgFor(input: {
  profile: VolumeProfile;
  yFor: (price: number) => number;
  x: number;
  maxWidth: number;
  chartLeft: number;
  chartRight: number;
}): string {
  const maxVolume = Math.max(1, ...input.profile.bins.map((bin) => bin.volume));
  const bars = input.profile.bins.map((bin) => {
    const yTop = input.yFor(bin.high);
    const yBottom = input.yFor(bin.low);
    const width = Math.max(1, (bin.volume / maxVolume) * input.maxWidth);
    const inValue = bin.high >= input.profile.valueAreaLow && bin.low <= input.profile.valueAreaHigh;
    const fill = Math.abs(bin.mid - input.profile.poc) <= input.profile.binSize / 2 ? "#facc15" : inValue ? "#38bdf8" : "#64748b";
    return `<rect x="${input.x}" y="${yTop.toFixed(2)}" width="${width.toFixed(2)}" height="${Math.max(1, yBottom - yTop).toFixed(2)}" fill="${fill}" opacity="0.42"/>`;
  }).join("\n");

  const line = (price: number, color: string, label: string) => {
    const y = input.yFor(price);
    return `<line x1="${input.chartLeft}" y1="${y.toFixed(2)}" x2="${input.chartRight + input.maxWidth + 28}" y2="${y.toFixed(2)}" stroke="${color}" stroke-width="2" stroke-dasharray="8 5"/>
<text x="${input.chartRight + 36}" y="${(y - 5).toFixed(2)}" fill="${color}">${label} ${price.toFixed(2)}</text>`;
  };

  return [
    `<text x="${input.x}" y="28" class="strong">window volume profile</text>`,
    bars,
    line(input.profile.valueAreaHigh, "#38bdf8", "VAH"),
    line(input.profile.poc, "#facc15", "POC"),
    line(input.profile.valueAreaLow, "#38bdf8", "VAL"),
  ].join("\n");
}

function diagnosticSvgFor(input: {
  marker: TradeMarker | null;
  profile: VolumeProfile | null;
  x: number;
  y: number;
}): string {
  if (!input.profile) {
    return `<text x="${input.x}" y="${input.y}" class="strong">profile: unavailable</text>`;
  }
  const lines = [
    `POC ${input.profile.poc.toFixed(2)} | VAL ${input.profile.valueAreaLow.toFixed(2)} | VAH ${input.profile.valueAreaHigh.toFixed(2)}`,
    `window total volume ${input.profile.totalVolume.toFixed(2)}`,
  ];
  if (input.marker) {
    const entryDistance = Math.abs(input.marker.entry - input.profile.poc);
    const targetDistance = Math.abs(input.marker.target - input.profile.poc);
    const stopDistance = Math.abs(input.marker.stop - input.profile.poc);
    lines.push(`entry is ${valueLocation(input.marker.entry, input.profile)}; target is ${targetDistance < entryDistance ? "toward POC" : "away from POC"}; stop distance to POC ${stopDistance.toFixed(2)}`);
    lines.push(`entry distance to POC ${entryDistance.toFixed(2)}; target distance to POC ${targetDistance.toFixed(2)}`);
  }
  return lines.map((line, index) => `<text x="${input.x}" y="${input.y + index * 18}" class="${index === 0 ? "strong" : "small"}">${escapeHtml(line)}</text>`).join("\n");
}

function valueLocation(price: number, profile: VolumeProfile): string {
  if (price > profile.valueAreaHigh) return "above value";
  if (price < profile.valueAreaLow) return "below value";
  if (Math.abs(price - profile.poc) <= profile.binSize) return "near POC";
  return "inside value";
}

function priceGrid(
  minPrice: number,
  maxPrice: number,
  yFor: (price: number) => number,
  width: number,
  pad: { left: number; right: number; top: number; bottom: number },
): string {
  const lines: string[] = [];
  const steps = 6;
  for (let index = 0; index <= steps; index += 1) {
    const price = minPrice + ((maxPrice - minPrice) * index) / steps;
    const y = yFor(price);
    lines.push(`<line x1="${pad.left}" y1="${y.toFixed(2)}" x2="${width - pad.right}" y2="${y.toFixed(2)}" stroke="#233047" stroke-width="1"/>`);
    lines.push(`<text x="12" y="${(y + 4).toFixed(2)}">${price.toFixed(2)}</text>`);
  }
  return lines.join("\n");
}

function markerSvgFor(
  marker: TradeMarker,
  xFor: (time: number) => number,
  yFor: (price: number) => number,
  width: number,
  rightPad: number,
): string {
  const x = xFor(marker.at);
  const line = (price: number, color: string, label: string) => {
    const y = yFor(price);
    return `<line x1="72" y1="${y.toFixed(2)}" x2="${width - rightPad}" y2="${y.toFixed(2)}" stroke="${color}" stroke-width="1.5" stroke-dasharray="6 4"/>
<text x="${width - rightPad - 160}" y="${(y - 6).toFixed(2)}" fill="${color}">${label} ${price.toFixed(2)}</text>`;
  };
  return [
    `<line x1="${x.toFixed(2)}" y1="44" x2="${x.toFixed(2)}" y2="584" stroke="#facc15" stroke-width="2"/>`,
    `<text x="${(x + 6).toFixed(2)}" y="62" fill="#facc15">${marker.side} entry ${utcTimeLabel(marker.at)} UTC</text>`,
    line(marker.entry, "#facc15", "entry"),
    line(marker.stop, "#ef4444", "stop"),
    line(marker.target, "#22c55e", "target"),
  ].join("\n");
}

function dateRange(start: number, end: number): string[] {
  const dates: string[] = [];
  const current = new Date(start);
  current.setUTCHours(0, 0, 0, 0);
  const last = new Date(end);
  last.setUTCHours(0, 0, 0, 0);
  while (current.getTime() <= last.getTime()) {
    dates.push(current.toISOString().slice(0, 10));
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return dates;
}

function eventTime(event: OrderflowEvent): number {
  return event.type === "trade" ? event.trade.time : event.receivedAt;
}

function isMissingFileError(error: unknown): boolean {
  return error instanceof Error
    && "code" in error
    && (error as NodeJS.ErrnoException).code === "ENOENT";
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#039;",
  }[char]!));
}

