import { ArrowUpRight } from "lucide-react";

const ARCSCAN_TX = "https://testnet.arcscan.app/tx/";

/**
 * Server-rendered "registered Arc AI agent" chip for the public profile.
 * Renders nothing until the background ERC-8004 registration lands
 * (erc8004TokenId stays null in that window). Links to the registration
 * tx on Arcscan since that's the single artifact a judge needs to verify
 * "this Selbo is a real on-chain identity, not a marketing claim."
 */
export function Erc8004Badge({
  tokenId,
  registrationTxHash,
}: {
  tokenId: string | null;
  registrationTxHash: string | null;
}) {
  if (!tokenId) return null;

  const label = `Arc Agent #${tokenId}`;

  if (!registrationTxHash) {
    return (
      <span
        className="inline-flex items-center gap-1.5 border border-[var(--neon-cyan)] px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--neon-cyan)]"
        title={`Token ID ${tokenId}`}
      >
        {label}
      </span>
    );
  }

  return (
    <a
      href={`${ARCSCAN_TX}${registrationTxHash}`}
      target="_blank"
      rel="noreferrer"
      title={`Registration tx ${registrationTxHash}`}
      className="inline-flex items-center gap-1.5 border border-[var(--neon-cyan)] px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--neon-cyan)] hover:bg-[var(--neon-cyan)] hover:text-black"
    >
      {label}
      <ArrowUpRight aria-hidden className="h-3 w-3 opacity-70" />
    </a>
  );
}
