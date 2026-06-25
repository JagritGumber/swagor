import { db } from "@/lib/db/client";
import { selboInstances } from "@/lib/db/schema";
import { isNotNull } from "drizzle-orm";
import { deployAnchorContract } from "@/app/services/arc/deploy-anchor.service";

/**
 * One-shot: deploy the PortfolioDecisions contract on Arc-Testnet from a
 * funded Circle wallet and register its address in arc_contracts. This
 * is what activates anchoring (the registry was empty so every anchor
 * silently skipped). Permissionless contract; deployer only pays gas.
 * Run: bun --conditions react-server scripts/arc-deploy.ts
 */
const [inst] = await db.select({ wallet: selboInstances.circleWalletId })
  .from(selboInstances).where(isNotNull(selboInstances.circleWalletId)).limit(1);
if (!inst?.wallet) { console.error("No instance with a Circle wallet found"); process.exit(1); }

console.log("Deploying PortfolioDecisions on ARC-TESTNET from wallet", inst.wallet.slice(0, 8) + "... (polls up to 5 min)");
const result = await deployAnchorContract(inst.wallet);
console.log("DEPLOYED + REGISTERED:", JSON.stringify(result, null, 2));
process.exit(0);


