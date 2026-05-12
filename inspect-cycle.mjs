import postgres from "postgres";

const cycleIdPrefix = process.argv[2];
if (!cycleIdPrefix) {
  console.error("Usage: bun run inspect-cycle.mjs <cycle-id-prefix>");
  process.exit(1);
}

const sql = postgres(process.env.DATABASE_URL, { prepare: false });

const [cycle] = await sql`
  SELECT id, status, started_at, completed_at, arc_tx_hash, cycle_state
  FROM rebalance_cycles
  WHERE id::text LIKE ${`${cycleIdPrefix}%`}
  LIMIT 1
`;

if (!cycle) {
  console.error(`No cycle found matching prefix: ${cycleIdPrefix}`);
  await sql.end();
  process.exit(1);
}

console.log("\n=== CYCLE ===");
console.log("id:", cycle.id);
console.log("status:", cycle.status);
console.log("started:", cycle.started_at);
console.log("completed:", cycle.completed_at);
console.log("arcTxHash:", cycle.arc_tx_hash);

const cs = cycle.cycle_state ?? {};

if (cs.error) {
  console.log("\n=== ERROR ===");
  console.log(cs.error);
}

if (cs.aggregated) {
  console.log("\n=== AGGREGATED SWARM CONSENSUS ===");
  console.log("decision:", cs.aggregated.decision);
  console.log("regime:", cs.aggregated.regime_assessment);
  console.log("rationale:", cs.aggregated.rationale);
  console.log("if_rotate:", JSON.stringify(cs.aggregated.if_rotate));
  console.log("dispersion:", cs.aggregated.dispersion);
  console.log("decisionCounts:", JSON.stringify(cs.aggregated.decisionCounts));
  console.log("regimeCounts:", JSON.stringify(cs.aggregated.regimeCounts));
  console.log("safety_layer:", JSON.stringify(cs.aggregated.safety_layer));
}

if (cs.taxOptimizer) {
  console.log("\n=== TAX OPTIMIZER ===");
  console.log("approved_decision:", cs.taxOptimizer.approved_decision);
  console.log("rationale:", cs.taxOptimizer.rationale);
  console.log("tax_impact:", JSON.stringify(cs.taxOptimizer.tax_impact, null, 2));
  console.log("modifications:", cs.taxOptimizer.modifications);
  console.log("india_specific_flags:", JSON.stringify(cs.taxOptimizer.india_specific_flags));
}

if (cs.taxAdjusted && cs.taxAdjusted.decision !== cs.aggregated?.decision) {
  console.log("\n=== TAX-ADJUSTED (what Critic saw) ===");
  console.log("decision:", cs.taxAdjusted.decision);
  console.log("rationale:", cs.taxAdjusted.rationale);
}

if (cs.verdict) {
  console.log("\n=== CRITIC VERDICT ===");
  console.log("verdict:", cs.verdict.verdict);
  console.log("concerns:", JSON.stringify(cs.verdict.concerns, null, 2));
  console.log("suggested_modification:", cs.verdict.suggested_modification);
}

if (cs.arcAnchor) {
  console.log("\n=== ARC ANCHOR ===");
  console.log("contractAddress:", cs.arcAnchor.contractAddress);
  console.log("txId:", cs.arcAnchor.txId);
  console.log("cycleIdBytes32:", cs.arcAnchor.cycleIdBytes32);
}

if (cs.swarm && Array.isArray(cs.swarm)) {
  console.log(`\n=== SWARM (${cs.swarm.length} members) ===`);
  for (const m of cs.swarm) {
    const route = m.if_rotate
      ? ` → ${m.if_rotate.percent_of_portfolio}% ${m.if_rotate.from} -> ${m.if_rotate.to}`
      : "";
    console.log(
      `\n[${m.personaId}] ${m.decision} (conf=${m.confidence ?? "?"}, regime=${m.regime_assessment})${route}`,
    );
    console.log(`  ${m.rationale}`);
  }
}

await sql.end();
process.exit(0);
