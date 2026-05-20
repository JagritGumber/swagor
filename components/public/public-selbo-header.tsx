import { ArrowUpRight } from "lucide-react";
import { Erc8004Badge } from "./erc8004-badge";
import type { SelboInstance } from "@/lib/db/schema";

const ARCSCAN = "https://testnet.arcscan.app/address/";

const truncate = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

/**
 * Header strip for the public Selbo profile. Two-column grid: equity +
 * wallet + ERC-8004 chip on the left, watching list + strategy on the
 * right. Extracted from the page composition root to keep that file
 * under the 100 line cap.
 */
export function PublicSelboHeader({ username, instance }: { username: string; instance: SelboInstance }) {
  const balance = Number(instance.simulatedBalanceUsd);
  const watching = instance.currentlyWatching ?? ["ETH", "BTC", "SOL"];

  return (
    <header className="border border-[var(--hairline-strong)] bg-black p-8">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 font-mono text-xs uppercase tracking-[0.18em]">
        <span className="text-[var(--neon-cyan)]">Verified autonomous agent · {username}</span>
        <span className="border border-[var(--hairline-strong)] px-2 py-0.5 text-muted-foreground">paper mode</span>
      </div>
      <p className="mt-3 max-w-2xl text-sm text-foreground">
        Every decision is reasoned in the open and anchored on-chain to Arc. Audit exactly what it did and why.
      </p>
      <div className="mt-5 grid gap-6 sm:grid-cols-2">
        <div>
          <div className="font-mono text-xs uppercase tracking-[0.16em] text-muted-foreground">Agent identity</div>
          <div className="mt-2">
            <Erc8004Badge tokenId={instance.erc8004TokenId} registrationTxHash={instance.erc8004RegistrationTxHash} />
          </div>
          <div className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <a
              href={`${ARCSCAN}${instance.circleWalletAddress}`}
              target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-1.5 font-mono text-sm text-[var(--neon-cyan)] underline-offset-4 hover:underline"
            >
              {truncate(instance.circleWalletAddress)}
              <ArrowUpRight aria-hidden className="h-3.5 w-3.5 opacity-70" />
            </a>
            <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Arc Testnet</span>
          </div>
          <div className="mt-3 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            Paper balance <span className="tabular-nums text-foreground/80">${balance.toFixed(2)}</span>
          </div>
        </div>
        <div>
          <div className="font-mono text-xs uppercase tracking-[0.16em] text-muted-foreground">Watching</div>
          <div className="mt-1 font-mono text-base text-foreground">{watching.join(", ")}</div>
          <div className="mt-3 font-mono text-xs uppercase tracking-[0.16em] text-muted-foreground">Strategy</div>
          <p className="mt-1 text-sm text-foreground line-clamp-3">{instance.strategyText}</p>
        </div>
      </div>
    </header>
  );
}
