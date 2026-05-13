import { ArrowUpRight } from "lucide-react";

type ArcAnchor = {
  contractAddress?: string;
  txId?: string;
  cycleIdBytes32?: string;
  swarmTraceHash?: string;
};

const ARC_EXPLORER = "https://testnet.arcscan.app/tx/";

export function ArcAnchorSection({ anchor }: { anchor: ArcAnchor | null | undefined }) {
  if (!anchor) return null;

  return (
    <section className="border border-[var(--hairline-strong)] bg-black p-6 space-y-3">
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <div className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">Recorded on Arc</div>
          <h2 className="mt-3 text-2xl font-bold uppercase leading-tight text-foreground">Anchor</h2>
        </div>
        {anchor.txId && (
          <a
            href={`${ARC_EXPLORER}${anchor.txId}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 font-mono text-sm text-[var(--neon-cyan)] underline-offset-4 hover:underline"
          >
            view tx <ArrowUpRight aria-hidden className="h-3.5 w-3.5 opacity-70" />
          </a>
        )}
      </div>
      <Row label="Contract" value={anchor.contractAddress} />
      <Row label="Cycle id (bytes32)" value={anchor.cycleIdBytes32} />
      <Row label="Trace hash" value={anchor.swarmTraceHash} mono break />
    </section>
  );
}

function Row({ label, value, mono, break: brk }: { label: string; value?: string; mono?: boolean; break?: boolean }) {
  if (!value) return null;
  return (
    <div>
      <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
      <div className={`mt-1 font-mono text-xs text-foreground ${brk ? "break-all" : ""} ${mono ? "" : ""}`}>{value}</div>
    </div>
  );
}
