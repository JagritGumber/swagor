import type { SolonInstance } from "@/lib/db/schema/solon-instances";
import { ArrowUpRight } from "lucide-react";

const truncate = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

const ARCSCAN = "https://testnet.arcscan.app/address/";

/**
 * Server component. Shows the Circle Developer-Controlled Wallet that Solon
 * trades from on Arc Testnet. Auto-provisioned on first dashboard load via
 * ensureSolonInstance. The user does not control this wallet directly; they
 * can audit every trade via the Arc explorer link.
 */
export function SolonWalletCard({ instance }: { instance: SolonInstance }) {
  return (
    <section className="border border-[var(--hairline-strong)] bg-black p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold uppercase leading-tight text-foreground">
            Solon&apos;s wallet
          </h2>
          <p className="mt-2 max-w-md font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            Auto-provisioned. Paper mode. Solon signs every trade from here.
          </p>
        </div>
        <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
          <a
            href={`${ARCSCAN}${instance.circleWalletAddress}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 font-mono text-base text-[var(--neon-cyan)] underline-offset-4 hover:underline"
            title={instance.circleWalletAddress}
          >
            {truncate(instance.circleWalletAddress)}
            <ArrowUpRight aria-hidden className="h-3.5 w-3.5 opacity-70" />
          </a>
          <span className="font-mono text-base tabular-nums text-[var(--neon-green)]">
            ${Number(instance.simulatedBalanceUsd).toFixed(2)}
          </span>
        </div>
      </div>
    </section>
  );
}
