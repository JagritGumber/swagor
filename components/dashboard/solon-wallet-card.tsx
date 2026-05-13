import type { SolonInstance } from "@/lib/db/schema/solon-instances";
import { ArrowUpRight } from "lucide-react";
import { WatchingFooter } from "./watching-footer";

const truncate = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;
const ARCSCAN = "https://testnet.arcscan.app/address/";

/**
 * Solon at-a-glance. Server-rendered with the latest instance state.
 * Embeds a small client footer that polls /api/watcher/recent so the
 * "last check" line stays fresh without a full page reload.
 */
export function SolonWalletCard({ instance }: { instance: SolonInstance }) {
  const balance = Number(instance.simulatedBalanceUsd);
  const watching = instance.currentlyWatching ?? ["ETH", "BTC", "SOL"];

  return (
    <section className="border border-[var(--hairline-strong)] bg-black p-8">
      <h2 className="text-2xl font-bold uppercase leading-tight text-foreground">
        Selbo
      </h2>

      <div className="mt-6 font-mono text-4xl tabular-nums text-foreground">
        ${balance.toFixed(2)}
      </div>
      <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <a
          href={`${ARCSCAN}${instance.circleWalletAddress}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 font-mono text-sm text-[var(--neon-cyan)] underline-offset-4 hover:underline"
          title={instance.circleWalletAddress}
        >
          {truncate(instance.circleWalletAddress)}
          <ArrowUpRight aria-hidden className="h-3.5 w-3.5 opacity-70" />
        </a>
        <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
          Arc Testnet
        </span>
      </div>

      <div className="mt-6 h-px bg-[var(--hairline-strong)]" />

      <WatchingFooter initialWatching={watching} />
    </section>
  );
}
