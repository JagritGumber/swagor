import { deployAnchorContract } from "@/app/services/arc/deploy-anchor.service";
import { db } from "@/lib/db/client";
import { selboInstances } from "@/lib/db/schema";
import { asc } from "drizzle-orm";

/**
 * Deploy a fresh PortfolioDecisions contract on Arc Testnet from a Circle
 * wallet and upsert it into arc_contracts (the runtime anchor calls then pick
 * it up automatically). PortfolioDecisions is permissionless, so the deploying
 * wallet does not matter for correctness; we use the oldest Selbo instance's
 * wallet (the operator) unless --wallet <id> is passed.
 *
 * The deployed bytecode is contracts/yield_routing/PortfolioDecisions.compiled.json,
 * which MUST be compiled with a released solc (not a nightly) so the contract
 * can be source-verified on Arcscan afterwards.
 *
 * Run (prod registry + Circle creds from .env.production.local):
 *   NODE_ENV=production bun run arc:deploy
 *   NODE_ENV=production bun run arc:deploy -- --wallet <circleWalletId>
 */
async function main(): Promise<void> {
  const i = process.argv.indexOf("--wallet");
  let walletId = i >= 0 ? process.argv[i + 1] : undefined;

  if (!walletId) {
    const [row] = await db
      .select({ walletId: selboInstances.circleWalletId })
      .from(selboInstances)
      .orderBy(asc(selboInstances.createdAt))
      .limit(1);
    if (!row) throw new Error("No selbo_instances found to source a deploying wallet from");
    walletId = row.walletId;
  }

  console.log(`[arc:deploy] deploying PortfolioDecisions from wallet ${walletId} ...`);
  const result = await deployAnchorContract(walletId);
  console.log(`[arc:deploy] done:`);
  console.log(`  address:       ${result.address}`);
  console.log(`  contractId:    ${result.contractId}`);
  console.log(`  transactionId: ${result.transactionId}`);
  console.log(`  registry arc_contracts.portfolio_decisions updated -> ${result.address}`);
}

main().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
