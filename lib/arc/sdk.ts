import { createHash } from "node:crypto";
import { initiateDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";

/**
 * Recursive JSON-safe value type used for anchor reasoning payloads.
 * Service-boundary type so the compiler enforces JSON.stringify-safety
 * on inputs hashed into trace bytes32.
 */
export type AnchorJsonValue =
  | string
  | number
  | boolean
  | null
  | AnchorJsonValue[]
  | { [key: string]: AnchorJsonValue };

let sdk: ReturnType<typeof initiateDeveloperControlledWalletsClient> | null = null;

export function getSdk() {
  if (sdk) return sdk;
  const apiKey = process.env.CIRCLE_API_KEY;
  const entitySecret = process.env.CIRCLE_ENTITY_SECRET;
  if (!apiKey || !entitySecret) throw new Error("Circle credentials not set in env");
  sdk = initiateDeveloperControlledWalletsClient({ apiKey, entitySecret });
  return sdk;
}

export function uuidToBytes32(uuid: string): `0x${string}` {
  // UUIDv4 is 16 bytes; pad to bytes32 (32 bytes) by left-prefixing zeros.
  const hex = uuid.replace(/-/g, "").padStart(64, "0");
  return `0x${hex}`;
}

export function sha256Hex(data: unknown): `0x${string}` {
  const json = JSON.stringify(data);
  const hash = createHash("sha256").update(json).digest("hex");
  return `0x${hash}`;
}

export const ZERO_BYTES32 = `0x${"0".repeat(64)}` as `0x${string}`;
