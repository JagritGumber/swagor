import { db } from "@/lib/db/client";
import { dailyPlans } from "@/lib/db/schema";
import { isNotNull, eq, desc } from "drizzle-orm";
import { getSdk } from "@/lib/arc/sdk";

/** Inspect the real Circle state of the most recently anchored plan's tx. */
const [p] = await db.select({ id: dailyPlans.id, tx: dailyPlans.arcAnchorTx })
  .from(dailyPlans).where(isNotNull(dailyPlans.arcAnchorTx)).orderBy(desc(dailyPlans.generatedAt)).limit(1);
if (!p?.tx) { console.error("no anchored plan"); process.exit(1); }
console.log("plan", p.id.slice(0, 8), "circleTx", p.tx);
const resp = await getSdk().getTransaction({ id: p.tx });
const tx = (resp.data as { transaction?: Record<string, unknown> } | undefined)?.transaction
  ?? (resp.data as { data?: { transaction?: Record<string, unknown> } } | undefined)?.data?.transaction;
console.log("state:", tx?.state);
console.log("txHash:", tx?.txHash ?? "(none yet)");
console.log("errorReason:", tx?.errorReason ?? tx?.errorDetails ?? "(none)");
console.log("blockchain:", tx?.blockchain, "| feeLevel:", JSON.stringify(tx?.feeLevel ?? tx?.fee));
process.exit(0);


