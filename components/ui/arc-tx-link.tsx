import { ArrowUpRight } from "lucide-react";

const ARCSCAN_TX_URL = "https://testnet.arcscan.app/tx/";

export type ArcTxLinkProps = {
  /** On-chain tx hash once Circle reports state=COMPLETE, or `failed:STATE`. */
  hash: string | null | undefined;
  /** Circle's internal tx id, returned when the anchor is queued. */
  queuedId?: string | null | undefined;
  /** Inline label shown next to the link icon when the tx is mined. */
  label?: string;
  /** Text to show when nothing is queued and nothing is mined; default null. */
  emptyLabel?: string;
  /** Stop click from bubbling (for use inside clickable table rows). */
  stopPropagation?: boolean;
};

/**
 * Renders one of four states for an Arc anchor:
 *   - both queuedId + hash null/undefined  -> emptyLabel chip, or nothing
 *   - queuedId set, hash null              -> "anchoring..." muted chip
 *   - hash starts with "failed:"           -> "anchor failed" red chip
 *   - hash is a real on-chain tx hash      -> cyan link to Arcscan
 */
export function ArcTxLink({ hash, queuedId, label = "view", emptyLabel, stopPropagation = false }: ArcTxLinkProps) {
  if (!hash && !queuedId) {
    if (!emptyLabel) return null;
    return (
      <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
        {emptyLabel}
      </span>
    );
  }

  if (hash && hash.startsWith("failed:")) {
    return (
      <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--neon-red)]" title={hash}>
        anchor failed
      </span>
    );
  }

  if (!hash) {
    return (
      <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground" title={queuedId ?? ""}>
        anchoring...
      </span>
    );
  }

  return (
    <a
      href={`${ARCSCAN_TX_URL}${hash}`}
      target="_blank"
      rel="noreferrer"
      title={hash}
      onClick={stopPropagation ? (e) => e.stopPropagation() : undefined}
      className="inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--neon-cyan)] underline-offset-4 hover:underline"
    >
      {label}
      <ArrowUpRight aria-hidden className="h-3 w-3 opacity-70" />
    </a>
  );
}
