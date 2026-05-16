import "server-only";

export type CycleWarning = {
  severity: "info" | "warn" | "error";
  message: string;
};

type AggregationRow = {
  recommendedAllocation: unknown;
  dispersion: string | null;
} | null;

type BiasEntry = { asset?: unknown; bias?: unknown; confidence?: unknown };
type CompilerOutput = {
  watchlist?: unknown;
  biasByAsset?: unknown;
  riskCaps?: { maxLeverage?: unknown; maxNotionalPctOfEquity?: unknown };
};

function isBiasEntry(v: unknown): v is BiasEntry {
  return typeof v === "object" && v !== null && "asset" in v && "bias" in v;
}

function readCompilerOutput(reasoning: Array<{ agentName: string; output: unknown }>): CompilerOutput | null {
  const row = reasoning.find((r) => r.agentName === "plan-compiler");
  if (!row || typeof row.output !== "object" || row.output === null) return null;
  return row.output as CompilerOutput;
}

/**
 * Pre-scan a cycle's audit rows for things worth flagging before a
 * human opens the trace. Cheap pure function; no IO. The dev panel
 * surfaces these as chips at the top of the cycle view so an admin
 * can spot a hallucinating plan-compiler without reading every JSON
 * dump.
 */
export function findCycleWarnings(input: {
  watchlist: string[];
  aggregation: AggregationRow;
  agentReasoning: Array<{ agentName: string; output: unknown }>;
}): CycleWarning[] {
  const warnings: CycleWarning[] = [];
  const watchUpper = new Set(input.watchlist.map((s) => s.toUpperCase()));
  const dispersion = input.aggregation?.dispersion ? Number(input.aggregation.dispersion) : null;
  if (dispersion !== null && Number.isFinite(dispersion) && dispersion > 0.6) {
    warnings.push({ severity: "warn", message: `Swarm dispersion ${dispersion.toFixed(2)} > 0.6 (low consensus)` });
  }

  const compiler = readCompilerOutput(input.agentReasoning);
  if (!compiler) return warnings;

  if (Array.isArray(compiler.biasByAsset)) {
    for (const entry of compiler.biasByAsset) {
      if (!isBiasEntry(entry)) {
        warnings.push({ severity: "error", message: "biasByAsset entry malformed (missing asset or bias)" });
        continue;
      }
      const asset = typeof entry.asset === "string" ? entry.asset.toUpperCase() : null;
      if (asset && !watchUpper.has(asset)) {
        warnings.push({ severity: "error", message: `Plan recommends ${asset} which is NOT in your watchlist` });
      }
      const conf = typeof entry.confidence === "number" ? entry.confidence : null;
      if (conf !== null && (conf < 0 || conf > 1)) {
        warnings.push({ severity: "error", message: `${asset ?? "asset"} confidence ${conf} is outside 0-1` });
      }
    }
  }

  const lev = compiler.riskCaps?.maxLeverage;
  if (typeof lev === "number" && lev > 5) {
    warnings.push({ severity: "warn", message: `maxLeverage ${lev}x is aggressive (>5x)` });
  }
  const notional = compiler.riskCaps?.maxNotionalPctOfEquity;
  if (typeof notional === "number" && (notional <= 0 || notional > 100)) {
    warnings.push({ severity: "error", message: `maxNotionalPctOfEquity ${notional} is out of 0-100 range` });
  }

  return warnings;
}
