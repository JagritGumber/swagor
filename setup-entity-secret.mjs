/**
 * One-time helper to generate a Circle Developer-Controlled Wallets
 * entity secret + its RSA-4096 ciphertext for registration.
 *
 * Usage:
 *   1. Ensure CIRCLE_API_KEY is set in .env.local
 *   2. node setup-entity-secret.mjs
 *   3. Save the printed plaintext to .env.local as CIRCLE_ENTITY_SECRET
 *   4. Paste the printed ciphertext into Circle's Configurator UI
 *      (should be exactly 684 base64 characters)
 *
 * The plaintext NEVER touches Circle's servers. The Configurator stores
 * only the ciphertext, which can be decrypted by Circle to verify your
 * signed wallet operations.
 */

import { config } from "dotenv";
import { randomBytes } from "node:crypto";
import { generateEntitySecretCiphertext } from "@circle-fin/developer-controlled-wallets";

config({ path: ".env.local" });

const apiKey = process.env.CIRCLE_API_KEY;
if (!apiKey?.trim()) {
  console.error("\nERROR: CIRCLE_API_KEY is not set in .env.local.\n");
  console.error("1. Get your API Key from https://console.circle.com (the 'API Key' type)");
  console.error("2. Add it to .env.local as CIRCLE_API_KEY=...");
  console.error("3. Re-run this script\n");
  process.exit(1);
}

const entitySecret = randomBytes(32).toString("hex");

console.log("\n=================================================================");
console.log("PLAINTEXT ENTITY SECRET (save this!)");
console.log("=================================================================");
console.log(entitySecret);
console.log();
console.log("Add to .env.local:");
console.log(`CIRCLE_ENTITY_SECRET=${entitySecret}`);
console.log("\nAlso save it in a password manager. If you lose it, you cannot");
console.log("recover it; you will have to regenerate and re-register, which");
console.log("invalidates any wallets created with the old secret.");

console.log("\nEncrypting with Circle's public RSA-4096 key...");

const ciphertext = await generateEntitySecretCiphertext({
  apiKey,
  entitySecret,
});

console.log("\n=================================================================");
console.log("CIPHERTEXT (paste this into Circle's Configurator UI)");
console.log("=================================================================");
console.log(ciphertext);
console.log(`\nLength: ${ciphertext.length} characters (Circle expects 684)`);
console.log("\nDone. Save the plaintext, paste the ciphertext, and you're set.");
