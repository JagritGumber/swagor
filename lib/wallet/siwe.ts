import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const HMAC_ALGO = "sha256";

/** Cookie name for the HMAC-signed wallet-verification nonce. Lives here
 *  (not in the route file) because Next.js route.ts files can only export
 *  handlers + a small config allowlist; any other named export fails the
 *  route-shape typecheck at build time. */
export const WALLET_NONCE_COOKIE = "selbo_wallet_nonce";

function getSecret(): string {
  const s = process.env.BETTER_AUTH_SECRET;
  if (!s) throw new Error("BETTER_AUTH_SECRET not set");
  return s;
}

export function generateNonce(): string {
  return randomBytes(16).toString("hex");
}

export type NoncePayload = {
  nonce: string;
  userId: string;
  exp: number;
};

/** Sign a nonce payload with HMAC-SHA256 and return a single cookie-safe
 *  string in the form `<base64url(json)>.<base64url(sig)>`. */
export function signNonce(payload: NoncePayload): string {
  const json = JSON.stringify(payload);
  const sig = createHmac(HMAC_ALGO, getSecret()).update(json).digest("base64url");
  const payloadB64 = Buffer.from(json).toString("base64url");
  return `${payloadB64}.${sig}`;
}

/** Verify a signed nonce cookie. Returns the payload if valid AND tied to
 *  the expected userId AND not expired. Constant-time signature comparison. */
export function verifyNonceCookie(
  value: string,
  expectedUserId: string,
): NoncePayload | null {
  const parts = value.split(".");
  if (parts.length !== 2) return null;
  const [payloadB64, sig] = parts;
  let json: string;
  try {
    json = Buffer.from(payloadB64, "base64url").toString("utf8");
  } catch {
    return null;
  }
  const expectedSig = createHmac(HMAC_ALGO, getSecret()).update(json).digest("base64url");
  const a = new Uint8Array(Buffer.from(sig));
  const b = new Uint8Array(Buffer.from(expectedSig));
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  let payload: NoncePayload;
  try {
    payload = JSON.parse(json) as NoncePayload;
  } catch {
    return null;
  }
  if (payload.userId !== expectedUserId) return null;
  if (typeof payload.exp !== "number" || payload.exp < Date.now()) return null;
  return payload;
}

/** Build an EIP-4361 (SIWE) message string for the client to sign. */
export function buildSiweMessage(args: {
  domain: string;
  address: string;
  uri: string;
  chainId: number;
  nonce: string;
  issuedAt: string;
  statement?: string;
}): string {
  const statement =
    args.statement ?? "Selbo wallet verification. One-time signature, no transaction.";
  return [
    `${args.domain} wants you to sign in with your Ethereum account:`,
    args.address,
    "",
    statement,
    "",
    `URI: ${args.uri}`,
    "Version: 1",
    `Chain ID: ${args.chainId}`,
    `Nonce: ${args.nonce}`,
    `Issued At: ${args.issuedAt}`,
  ].join("\n");
}
