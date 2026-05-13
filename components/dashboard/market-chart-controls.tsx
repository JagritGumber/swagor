"use client";

export type ChartType = "candles" | "line" | "area";
export type Interval = "1m" | "5m" | "15m" | "1h" | "4h" | "1d";
export type Lookback = { label: string; ms: number };

export const LOOKBACKS: Lookback[] = [
  { label: "1H", ms: 3_600_000 },
  { label: "6H", ms: 21_600_000 },
  { label: "24H", ms: 86_400_000 },
  { label: "7D", ms: 604_800_000 },
  { label: "30D", ms: 2_592_000_000 },
];

export const INTERVALS: Interval[] = ["1m", "5m", "15m", "1h", "4h", "1d"];
export const CHART_TYPES: ChartType[] = ["candles", "line", "area"];

function Btn({ active, onClick, children }: {
  active: boolean; onClick: () => void; children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-7 items-center justify-center border px-2.5 font-mono text-[11px] font-bold uppercase tracking-[0.16em] transition ${
        active
          ? "border-[var(--neon-cyan)] bg-[var(--neon-cyan)] text-black"
          : "border-[var(--hairline-strong)] bg-black text-foreground hover:border-[var(--neon-cyan)] hover:text-[var(--neon-cyan)]"
      }`}
    >
      {children}
    </button>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-20 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </span>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

export function MarketChartControls({
  watching, asset, interval, lookbackMs, chartType,
  onAsset, onInterval, onLookback, onChartType,
}: {
  watching: string[];
  asset: string;
  interval: Interval;
  lookbackMs: number;
  chartType: ChartType;
  onAsset: (a: string) => void;
  onInterval: (i: Interval) => void;
  onLookback: (ms: number) => void;
  onChartType: (t: ChartType) => void;
}) {
  return (
    <div className="flex flex-col gap-2.5">
      <Row label="Asset">
        {watching.map((a) => (
          <Btn key={a} active={asset === a} onClick={() => onAsset(a)}>{a}</Btn>
        ))}
      </Row>
      <Row label="Timeframe">
        {INTERVALS.map((i) => (
          <Btn key={i} active={interval === i} onClick={() => onInterval(i)}>{i}</Btn>
        ))}
      </Row>
      <Row label="Window">
        {LOOKBACKS.map((l) => (
          <Btn key={l.label} active={lookbackMs === l.ms} onClick={() => onLookback(l.ms)}>{l.label}</Btn>
        ))}
      </Row>
      <Row label="Type">
        {CHART_TYPES.map((t) => (
          <Btn key={t} active={chartType === t} onClick={() => onChartType(t)}>{t}</Btn>
        ))}
      </Row>
    </div>
  );
}
