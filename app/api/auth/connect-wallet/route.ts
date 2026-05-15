import { NextResponse } from "next/server";
import { headers, cookies } from "next/headers";
import { verifyMessage } from "viem";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { selboInstances } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { verifyNonceCookie } from "@/lib/wallet/siwe";
import { WALLET_NONCE_COOKIE } from "@/app/api/auth/wallet-nonce/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;

type ConnectBody = {
  address?: unknown;
  message?: unknown;
  signature?: unknown;
};

/**
 * Verify the SIWE-style signature and link the wallet to the user's Selbo
 * instance. Rejects: unauthed user, expired/missing nonce cookie, nonce
 * not present in the signed message, signature that doesn't recover to the
 * claimed address, or address already linked to a different user (unique
 * constraint -> 409).
 */
export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as ConnectBody;
  const address = typeof body.address === "string" ? body.address.trim() : "";
  const message = typeof body.message === "string" ? body.message : "";
  const signature = typeof body.signature === "string" ? body.signature : "";

  if (!ADDRESS_REGEX.test(address)) {
    return NextResponse.json({ error: "Invalid address" }, { status: 400 });
  }
  if (!message || !signature) {
    return NextResponse.json({ error: "Missing message or signature" }, { status: 400 });
  }

  const cookieStore = await cookies();
  const nonceCookie = cookieStore.get(WALLET_NONCE_COOKIE)?.value;
  if (!nonceCookie) {
    return NextResponse.json(
      { error: "Nonce expired. Reload the page and try again." },
      { status: 400 },
    );
  }
  const payload = verifyNonceCookie(nonceCookie, session.user.id);
  if (!payload) {
    return NextResponse.json({ error: "Nonce verification failed" }, { status: 400 });
  }
  if (!message.includes(`Nonce: ${payload.nonce}`)) {
    return NextResponse.json({ error: "Message nonce mismatch" }, { status: 400 });
  }

  const valid = await verifyMessage({
    address: address as `0x${string}`,
    message,
    signature: signature as `0x${string}`,
  });
  if (!valid) {
    return NextResponse.json({ error: "Signature did not verify" }, { status: 400 });
  }

  const lower = address.toLowerCase();
  try {
    const [row] = await db
      .update(selboInstances)
      .set({ externalWalletAddress: lower })
      .where(eq(selboInstances.userId, session.user.id))
      .returning({ id: selboInstances.id, externalWalletAddress: selboInstances.externalWalletAddress });
    if (!row) {
      return NextResponse.json({ error: "No Selbo instance" }, { status: 404 });
    }
    cookieStore.delete(WALLET_NONCE_COOKIE);
    return NextResponse.json({ ok: true, address: row.externalWalletAddress });
  } catch (err) {
    // unique constraint violation -> wallet already linked elsewhere
    if (err instanceof Error && /unique|duplicate/i.test(err.message)) {
      return NextResponse.json(
        { error: "This wallet is already linked to another account." },
        { status: 409 },
      );
    }
    throw err;
  }
}
