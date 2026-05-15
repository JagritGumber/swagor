import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth/admin";
import { getMetrics, type Metrics } from "@/app/services/metrics/aggregator.service";

export const dynamic = "force-dynamic";

function fmtUsd(n: number): string {
  if (!Number.isFinite(n)) return "n/a";
  return `$${n.toLocaleString("en-US", { maximumFractionDigits: 2, minimumFractionDigits: 0 })}`;
}

function fmtNum(n: number): string {
  if (!Number.isFinite(n)) return "n/a";
  return n.toLocaleString("en-US");
}

function fmtPct(n: number | null, digits = 1): string {
  if (n === null || !Number.isFinite(n)) return "n/a";
  return `${n.toFixed(digits)}%`;
}

type Cell = { label: string; value: string; tone?: string };

function cellsFromMetrics(m: Metrics): Cell[] {
  const pnlTone = m.realizedPnlUsdLifetime > 0
    ? "text-[var(--neon-green)]"
    : m.realizedPnlUsdLifetime < 0 ? "text-[var(--neon-red)]" : undefined;
  const emergencyTone = m.riskEmergencies24h > 0 ? "text-[var(--neon-red)]" : undefined;
  return [
    { label: "Active Selbos", value: fmtNum(m.activeInstances) },
    { label: "Watcher ticks (24h)", value: fmtNum(m.watcherTicks24h) },
    { label: "Risk emergencies (24h)", value: fmtNum(m.riskEmergencies24h), tone: emergencyTone },
    { label: "Trades opened (24h)", value: fmtNum(m.tradesOpened24h) },
    { label: "Trades closed (24h)", value: fmtNum(m.tradesClosed24h) },
    { label: "Paper volume (24h)", value: fmtUsd(m.paperVolume24hUsd) },
    { label: "Realized PnL (lifetime)", value: fmtUsd(m.realizedPnlUsdLifetime), tone: pnlTone },
    { label: "Win rate (lifetime)", value: fmtPct(m.winRatePctLifetime) },
    { label: "LLM calls (24h)", value: fmtNum(m.llmCalls24h) },
    { label: "LLM tokens (24h)", value: fmtNum(m.llmTokens24h) },
  ];
}

/**
 * Admin-gated RFB 01 traction page. Sub-second server-rendered; refresh
 * the page to refetch. Numbers source from monitor_ticks, trades, and
 * llm_calls. Lifetime stats roll across project history; 24h windows
 * use the row's primary timestamp as the cutoff.
 */
export default async function MetricsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in");
  if (!isAdmin(session.user.email)) redirect("/dashboard");

  const metrics = await getMetrics();
  const cells = cellsFromMetrics(metrics);

  return (
    <div className="mx-auto max-w-5xl pb-24">
      <header className="mb-6 flex items-baseline gap-3">
        <span aria-hidden className="inline-block h-2.5 w-2.5 bg-[var(--neon-cyan)]" />
        <h1 className="text-3xl font-bold uppercase leading-tight text-foreground">
          RFB 01 traction
        </h1>
        <span className="ml-auto font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          generated {new Date(metrics.generatedAt).toLocaleString()}
        </span>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {cells.map((c) => (
          <div key={c.label} className="border border-[var(--hairline-strong)] bg-black p-4">
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              {c.label}
            </div>
            <div className={`mt-2 font-mono text-2xl tabular-nums ${c.tone ?? "text-foreground"}`}>
              {c.value}
            </div>
          </div>
        ))}
      </div>

      <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        Admin only. Reads aggregate counts; no per-user PII rendered on this page.
      </p>
    </div>
  );
}
