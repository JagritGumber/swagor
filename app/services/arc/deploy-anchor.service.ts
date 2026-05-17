import "server-only";
import { readFileSync } from "fs";
import path from "path";
import { initiateSmartContractPlatformClient, type Blockchain } from "@circle-fin/smart-contract-platform";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { arcContracts } from "@/lib/db/schema";

type Compiled = { abi: unknown[]; bytecode: string };
let scpSdk: ReturnType<typeof initiateSmartContractPlatformClient> | null = null;

function getScpSdk() {
  if (scpSdk) return scpSdk;
  const apiKey = process.env.CIRCLE_API_KEY;
  const entitySecret = process.env.CIRCLE_ENTITY_SECRET;
  if (!apiKey || !entitySecret) throw new Error("Circle credentials not set in env");
  scpSdk = initiateSmartContractPlatformClient({ apiKey, entitySecret });
  return scpSdk;
}

/**
 * Deploy a fresh PortfolioDecisions contract on Arc Testnet via Circle Smart
 * Contract Platform, then upsert the new address into arc_contracts so all
 * runtime anchor calls (anchorClosedTrade, anchorDailyAnalysis, etc.) pick
 * it up. Replaces the old deploy-anchor-contract.mjs script.
 *
 * Uses the caller's own Circle wallet (passed from the admin endpoint as
 * the admin user's selbo_instance.circleWalletId). PortfolioDecisions is
 * permissionless so the deployer doesn't matter for correctness; the deploy
 * is just a one-shot setup action.
 *
 * Polling: getContract every 5s for up to 5 minutes. ARC-TESTNET confirms
 * in ~0.5s but Circle indexing can add a few seconds.
 */
export async function deployAnchorContract(
  walletId: string,
): Promise<{ address: string; contractId: string; transactionId: string }> {
  const compiledPath = path.join(process.cwd(), "contracts/yield_routing/PortfolioDecisions.compiled.json");
  const compiled = JSON.parse(readFileSync(compiledPath, "utf8")) as Compiled;

  const resp = await getScpSdk().deployContract({
    name: "PortfolioDecisions",
    description: "Anchors AI agent portfolio decisions on Arc",
    walletId,
    blockchain: "ARC-TESTNET" as Blockchain,
    abiJson: JSON.stringify(compiled.abi),
    bytecode: compiled.bytecode,
    fee: { type: "level", config: { feeLevel: "MEDIUM" } },
  });
  const contractId = resp.data?.contractId;
  const transactionId = resp.data?.transactionId;
  if (!contractId || !transactionId) {
    throw new Error("Circle deployContract response missing contractId or transactionId");
  }

  let address: string | null = null;
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 5000));
    const r = await getScpSdk().getContract({ id: contractId });
    const c = r.data?.contract;
    if (c?.contractAddress) { address = c.contractAddress; break; }
    if (c?.deploymentErrorReason) throw new Error(`Deploy failed: ${c.deploymentErrorReason}`);
  }
  if (!address) throw new Error("Deploy polling timed out before contractAddress was set");

  await db.insert(arcContracts).values({
    key: "portfolio_decisions",
    address,
    label: "PortfolioDecisions (auto-deployed)",
  }).onConflictDoUpdate({
    target: arcContracts.key,
    set: { address, label: "PortfolioDecisions (auto-deployed)", updatedAt: sql`now()` },
  });

  return { address, contractId, transactionId };
}
