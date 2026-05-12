import type { SolonInstance } from "@/lib/db/schema/solon-instances";

const truncate = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

/**
 * Server component. Shows the user's auto-provisioned Circle wallet on
 * Arc Testnet plus the simulated USD balance. The wallet is created on
 * first dashboard load via ensureSolonInstance().
 */
export function SolonWalletCard({ instance }: { instance: SolonInstance }) {
  return (
    <section className="border border-[var(--hairline-strong)] bg-black p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-2xl font-bold uppercase leading-tight text-foreground">
          Your wallet
        </h2>
        <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
          <code
            className="font-mono text-base text-[var(--neon-cyan)]"
            title={instance.circleWalletAddress}
          >
            {truncate(instance.circleWalletAddress)}
          </code>
          <span className="font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">
            Arc Testnet
          </span>
          <span className="font-mono text-base tabular-nums text-foreground">
            ${Number(instance.simulatedBalanceUsd).toFixed(2)}
          </span>
        </div>
      </div>
    </section>
  );
}
