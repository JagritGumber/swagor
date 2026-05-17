import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/auth/admin";
import { db } from "@/lib/db/client";
import { selboInstances } from "@/lib/db/schema";
import { deployAnchorContract } from "@/app/services/arc/deploy-anchor.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Admin "fix my missing anchor address" button. Deploys a fresh
 * PortfolioDecisions contract from the admin's own Circle wallet, then
 * upserts the new address into arc_contracts.portfolio_decisions.
 * Subsequent anchor calls pick it up automatically (no env reload, no
 * code change, no manual address entry).
 *
 * From the browser dev tools while logged in as admin:
 *   fetch('/api/admin/arc-contracts/deploy', { method: 'POST' })
 *     .then(r => r.json()).then(console.log)
 */
export async function POST() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(session.user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [instance] = await db.select({ circleWalletId: selboInstances.circleWalletId })
    .from(selboInstances).where(eq(selboInstances.userId, session.user.id)).limit(1);
  if (!instance) return NextResponse.json({ error: "No Selbo instance" }, { status: 404 });

  try {
    const result = await deployAnchorContract(instance.circleWalletId);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[admin/arc-contracts/deploy]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
