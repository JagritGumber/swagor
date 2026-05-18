import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/auth/admin";
import { db } from "@/lib/db/client";
import { arcContracts } from "@/lib/db/schema";
import { sql } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({
  key: z.enum(["portfolio_decisions", "identity_registry", "usdc", "treasury_wallet", "seed_wallet"]),
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Must be a 0x-prefixed 40-hex EVM address"),
  label: z.string().optional(),
  /** Required when the entry is a wallet we transmit FROM (seed_wallet). */
  walletId: z.string().optional(),
});

/**
 * Admin upsert for the Arc contract registry. After `bun run db:push` lands
 * the table + IdentityRegistry seed, run:
 *   curl -X POST https://selbo.app/api/admin/arc-contracts \
 *     -H 'Content-Type: application/json' \
 *     -d '{"key":"portfolio_decisions","address":"0xYOURDEPLOYEDADDR"}'
 *
 * For seed_wallet (used to fund new users), pass both the EVM address and
 * the Circle walletId so the runtime can transmit FROM it:
 *   ... -d '{"key":"seed_wallet","address":"0xSEED","walletId":"CIRCLE_WALLET_UUID"}'
 */
export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(session.user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const json = await request.json().catch(() => null);
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const { key, address, label, walletId } = parsed.data;
  await db.insert(arcContracts)
    .values({ key, address, label: label ?? null, walletId: walletId ?? null })
    .onConflictDoUpdate({
      target: arcContracts.key,
      set: { address, label: label ?? null, walletId: walletId ?? null, updatedAt: sql`now()` },
    });

  return NextResponse.json({ key, address, label: label ?? null, walletId: walletId ?? null });
}

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(session.user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const rows = await db.select().from(arcContracts);
  return NextResponse.json({ contracts: rows });
}
