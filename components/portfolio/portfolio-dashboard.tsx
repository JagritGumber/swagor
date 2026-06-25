import type { PositionView } from "@/app/services/positions.service";
import type { LifetimeStats } from "@/app/services/trades.service";
import { PositionsTable } from "@/components/dashboard/positions-table";
import { ReaderCard } from "./reader-read";

function fmtUsd(n: number): string {
  const sign = n >= 0 ? "+" : "";
  return `${sign}$${n.toFixed(2)}`;
}

type Props = {
  username: string;
  balanceUsd: number;
  lifetime: LifetimeStats;
  positions: PositionView[];
  watching: string[];
};

export function PortfolioDashboard({ username, balanceUsd, lifetime, positions, watching }: Props) {
  const pnlTone =
    lifetime.realizedPnlUsd > 0
      ? "text-[var(--neon-green)]"
      : lifetime.realizedPnlUsd < 0
        ? "text-[var(--neon-red)]"
        : "text-foreground";

  return (
    <div className="space-y-4">
      {/* Header — balance + identity */}
      <div className="flex items-baseline justify-between border border-[var(--hairline-strong)] bg-black px-6 py-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Portfolio</p>
          <p className="mt-1 text-3xl font-bold tabular-nums text-foreground">
            ${balanceUsd.toFixed(2)}
          </p>
        </div>
        <div className="flex items-center gap-6 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
          {lifetime.closedTrades > 0 && (
            <span>
              P/L <span className={pnlTone}>{fmtUsd(lifetime.realizedPnlUsd)}</span>
            </span>
          )}
          <span>{positions.length} positions</span>
          <span>watching {watching.length} markets</span>
        </div>
      </div>

      {/* Reader card — regime + auction data */}
      <ReaderCard asset={watching[0] ?? "ETH"} />

      {/* Positions */}
      <PositionsTable positions={positions} bare />
    </div>
  );
}
