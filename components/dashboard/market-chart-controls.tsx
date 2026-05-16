"use client";

import { BarChart3, LineChart as LineIcon, AreaChart as AreaIcon } from "lucide-react";
import { Dropdown } from "./dropdown";

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

const COMMON_INTERVALS: Interval[] = ["5m", "15m", "1h", "4h", "1d"];
const EXTRA_INTERVALS: Interval[] = ["1m"];
type LookbackLabel = (typeof LOOKBACKS)[number]["label"];
const LOOKBACK_LABELS: LookbackLabel[] = LOOKBACKS.map((l) => l.label);

const TYPE_ICON: Record<ChartType, React.ReactNode> = {
  candles: <BarChart3 className="h-3.5 w-3.5" />,
  line: <LineIcon className="h-3.5 w-3.5" />,
  area: <AreaIcon className="h-3.5 w-3.5" />,
};

function InlineBtn({ active, onClick, children }: {
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

function Separator() {
  return <span aria-hidden className="mx-1 h-5 w-px bg-[var(--hairline)]" />;
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
  const extraSelected = EXTRA_INTERVALS.includes(interval);
  const currentLookback = (LOOKBACKS.find((l) => l.ms === lookbackMs)?.label ?? "24H") as LookbackLabel;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Dropdown
        value={asset}
        options={watching}
        onSelect={onAsset}
        ariaLabel="Select asset"
      />

      <Separator />

      {COMMON_INTERVALS.map((i) => (
        <InlineBtn key={i} active={interval === i} onClick={() => onInterval(i)}>
          {i}
        </InlineBtn>
      ))}
      <Dropdown<Interval>
        value={extraSelected ? interval : ("1m" as Interval)}
        options={EXTRA_INTERVALS}
        onSelect={onInterval}
        ariaLabel="More timeframes"
        label={extraSelected ? interval : "..."}
        active={extraSelected}
      />

      <Separator />

      <Dropdown<LookbackLabel>
        value={currentLookback}
        options={LOOKBACK_LABELS}
        onSelect={(label) => {
          const hit = LOOKBACKS.find((l) => l.label === label);
          if (hit) onLookback(hit.ms);
        }}
        ariaLabel="Window"
      />

      <Separator />

      <Dropdown<ChartType>
        value={chartType}
        options={CHART_TYPES}
        onSelect={onChartType}
        ariaLabel="Chart type"
        icon={TYPE_ICON[chartType]}
        iconOnly
        renderOption={(t) => (
          <span className="flex items-center gap-2">
            {TYPE_ICON[t]} {t}
          </span>
        )}
        align="right"
      />
    </div>
  );
}
