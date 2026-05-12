import type { SolonInstance } from "@/lib/db/schema/solon-instances";

/**
 * Thin Binance-style balance sparkline. Sample data until real cycle history
 * populates. Pure SVG, no JS, no chart library.
 */
const POINTS = [
  990, 988, 992, 995, 991, 998, 1003, 1001, 1008, 1015,
  1012, 1018, 1023, 1020, 1028, 1033, 1031, 1038, 1042, 1046,
  1043, 1048, 1052, 1058, 1062, 1059, 1065, 1071, 1075, 1080,
];
const W = 1000;
const H = 56;

function buildPath(points: number[]) {
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const step = W / (points.length - 1);
  return points
    .map((v, i) => {
      const x = (i * step).toFixed(1);
      const y = (H - ((v - min) / range) * H * 0.82 - H * 0.09).toFixed(1);
      return `${i === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");
}

export function BalanceSparkline({ instance }: { instance: SolonInstance }) {
  const balance = Number(instance.simulatedBalanceUsd);
  const path = buildPath(POINTS);
  const area = `${path} L ${W} ${H} L 0 ${H} Z`;

  return (
    <section className="border border-[var(--hairline)] bg-black p-6">
      <div className="flex items-baseline justify-between">
        <h2 className="text-2xl font-bold uppercase leading-tight text-foreground">
          Balance
        </h2>
        <span className="font-mono text-2xl tabular-nums text-foreground">
          ${balance.toFixed(2)}
        </span>
      </div>
      <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
        Sample trend. Real history populates as cycles run.
      </p>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="mt-4 block h-14 w-full"
        role="img"
        aria-label="Balance trend sample sparkline"
      >
        <defs>
          <linearGradient id="grad-spark" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--neon-cyan)" stopOpacity="0.18" />
            <stop offset="100%" stopColor="var(--neon-cyan)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#grad-spark)" />
        <path
          d={path}
          stroke="var(--neon-cyan)"
          strokeWidth="1.5"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </section>
  );
}
