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

type LookbackLabel = (typeof LOOKBACKS)[number]["label"];
const LOOKBACK_LABELS: LookbackLabel[] = LOOKBACKS.map((l) => l.label);

const TYPE_ICON: Record<ChartType, React.ReactNode> = {
  candles: <BarChart3 className="h-3.5 w-3.5" />,
  line: <LineIcon className="h-3.5 w-3.5" />,
  area: <AreaIcon className="h-3.5 w-3.5" />,
};

function Separator() {
  return <span aria-hidden className="h-5 w-px bg-[var(--hairline)]" />;
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
  const currentLookback = (LOOKBACKS.find((l) => l.ms === lookbackMs)?.label ?? "24H") as LookbackLabel;

  return (
    <div className="flex flex-wrap items-center gap-1">
      <Dropdown
        value={asset}
        options={watching}
        onSelect={onAsset}
        ariaLabel="Select asset"
      />

      <Separator />

      <div className="flex h-7 divide-x divide-[var(--hairline-strong)] border border-[var(--hairline-strong)]">
        {INTERVALS.map((i) => (
          <button
            key={i}
            type="button"
            onClick={() => onInterval(i)}
            className={`inline-flex items-center justify-center px-2.5 font-mono text-[11px] font-bold uppercase tracking-[0.16em] transition ${
              interval === i
                ? "bg-[var(--neon-cyan)] text-black"
                : "bg-black text-foreground hover:bg-[var(--neon-cyan)]/10 hover:text-[var(--neon-cyan)]"
            }`}
          >
            {i}
          </button>
        ))}
      </div>

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
