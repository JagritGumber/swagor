import type { SolonInstance } from "@/lib/db/schema/solon-instances";
import { ArrowUpRight } from "lucide-react";

const truncate = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;
const ARCSCAN = "https://testnet.arcscan.app/address/";

const TREND = [
  990, 988, 992, 995, 991, 998, 1003, 1001, 1008, 1015,
  1012, 1018, 1023, 1020, 1028, 1033, 1031, 1038, 1042, 1046,
  1043, 1048, 1052, 1058, 1062, 1059, 1065, 1071, 1075, 1080,
];
const W = 1000;
const H = 56;

function sparkPath() {
  const min = Math.min(...TREND);
  const range = (Math.max(...TREND) - min) || 1;
  const step = W / (TREND.length - 1);
  return TREND.map((v, i) => {
    const x = (i * step).toFixed(1);
    const y = (H - ((v - min) / range) * H * 0.82 - H * 0.09).toFixed(1);
    return `${i === 0 ? "M" : "L"} ${x} ${y}`;
  }).join(" ");
}

export function SolonWalletCard({ instance }: { instance: SolonInstance }) {
  const balance = Number(instance.simulatedBalanceUsd);
  const path = sparkPath();
  const area = `${path} L ${W} ${H} L 0 ${H} Z`;

  return (
    <section className="bg-black p-6">
      <h2 className="text-2xl font-bold uppercase leading-tight text-foreground">
        Solon&apos;s wallet
      </h2>
      <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
        Auto-provisioned. Paper mode. Solon signs every trade from here.
      </p>
      <div className="mt-5 font-mono text-3xl tabular-nums text-foreground">
        ${balance.toFixed(2)}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="mt-3 block h-12 w-full" role="img" aria-label="Balance trend">
        <defs>
          <linearGradient id="grad-solon-spark" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--neon-cyan)" stopOpacity="0.18" />
            <stop offset="100%" stopColor="var(--neon-cyan)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#grad-solon-spark)" />
        <path d={path} stroke="var(--neon-cyan)" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div className="mt-4 flex flex-wrap items-baseline gap-x-4 gap-y-1">
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
    </section>
  );
}
