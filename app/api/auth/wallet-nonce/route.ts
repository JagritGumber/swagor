import { NextResponse } from "next/server";
import { headers, cookies } from "next/headers";
import { auth } from "@/lib/auth";
import { buildSiweMessage, generateNonce, signNonce } from "@/lib/wallet/siwe";
import { arcTestnet } from "@/lib/web3/chains";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NONCE_TTL_MS = 5 * 60 * 1000;
const ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;
export const WALLET_NONCE_COOKIE = "selbo_wallet_nonce";

/**
 * Issue the full SIWE-style message for the client to sign, bound to:
 *   - the calling user (via Better Auth session)
 *   - the address the client just connected (provided in ?address=)
 * The nonce is HMAC-signed in an httpOnly cookie so the verify endpoint
 * can confirm the same browser/session originated the request. Client
 * signs the returned `message` verbatim; never reconstructs it locally.
 */
export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const address = (searchParams.get("address") ?? "").trim();
  if (!ADDRESS_REGEX.test(address)) {
    return NextResponse.json({ error: "Invalid address" }, { status: 400 });
  }

  const nonce = generateNonce();
  const cookieValue = signNonce({
    nonce,
    userId: session.user.id,
    exp: Date.now() + NONCE_TTL_MS,
  });

  const cookieStore = await cookies();
  cookieStore.set(WALLET_NONCE_COOKIE, cookieValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: NONCE_TTL_MS / 1000,
  });

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://selbo.trade";
  const host = new URL(siteUrl).host;
  const message = buildSiweMessage({
    domain: host,
    address,
    uri: siteUrl,
    chainId: arcTestnet.id,
    nonce,
    issuedAt: new Date().toISOString(),
  });

  return NextResponse.json({ message });
}
