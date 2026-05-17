/**
 * One-time ERC-8004 agent registration for Selbo on Arc Testnet.
 *  1. Calls register(string) on IdentityRegistry 0x8004A818... with the
 *     SELBO_AGENT_METADATA_URI (set to your self-hosted /selbo-agent.json
 *     once Slice 4 ships, or an ipfs:// URI in the meantime).
 *  2. Polls Circle until the tx state is COMPLETE.
 *  3. Reads Transfer(address,address,uint256) logs from the registry to
 *     extract the minted token ID for the agent.
 *  4. Prints the values you paste into .env.local: SELBO_AGENT_ID and
 *     SELBO_AGENT_REGISTRATION_TX.
 *
 * Run: node scripts/register-selbo-agent.mjs
 */
import { config } from "dotenv";
import { initiateDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";
import { createPublicClient, http, parseAbiItem } from "viem";

config({ path: ".env.local" });

const IDENTITY_REGISTRY = "0x8004A818BFB912233c491871b3d84c89A494BD9e";
const ARC_TESTNET_RPC = "https://rpc.testnet.arc.network";
const ARC_TESTNET_CHAIN = {
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: [ARC_TESTNET_RPC] } },
};

const {
  CIRCLE_API_KEY,
  CIRCLE_ENTITY_SECRET,
  NEXT_PUBLIC_AGENT_WALLET_ID,
  SELBO_AGENT_METADATA_URI,
  SELBO_AGENT_ID,
} = process.env;

if (SELBO_AGENT_ID) {
  console.log(`SELBO_AGENT_ID already set (${SELBO_AGENT_ID}); clear it to re-register. Bailing.`);
  process.exit(0);
}
const required = { CIRCLE_API_KEY, CIRCLE_ENTITY_SECRET, NEXT_PUBLIC_AGENT_WALLET_ID, SELBO_AGENT_METADATA_URI };
for (const [k, v] of Object.entries(required)) {
  if (!v) { console.error(`Missing ${k} in .env.local`); process.exit(1); }
}

const circle = initiateDeveloperControlledWalletsClient({
  apiKey: CIRCLE_API_KEY,
  entitySecret: CIRCLE_ENTITY_SECRET,
});

const walletResp = await circle.getWallet({ id: NEXT_PUBLIC_AGENT_WALLET_ID });
const ownerAddress = walletResp.data?.wallet?.address;
if (!ownerAddress) { console.error("Could not resolve owner wallet address from Circle."); process.exit(1); }
console.log(`Owner wallet: ${ownerAddress}`);
console.log(`Metadata URI: ${SELBO_AGENT_METADATA_URI}`);

console.log("Submitting register(string) to IdentityRegistry...");
const tx = await circle.createContractExecutionTransaction({
  walletId: NEXT_PUBLIC_AGENT_WALLET_ID,
  blockchain: "ARC-TESTNET",
  contractAddress: IDENTITY_REGISTRY,
  abiFunctionSignature: "register(string)",
  abiParameters: [SELBO_AGENT_METADATA_URI],
  fee: { type: "level", config: { feeLevel: "MEDIUM" } },
});
const circleTxId = tx.data?.id;
if (!circleTxId) { console.error("Circle did not return a tx id."); process.exit(1); }
console.log(`Circle tx id: ${circleTxId}. Polling for COMPLETE...`);

let onchainHash = null;
for (let i = 0; i < 30; i++) {
  await new Promise((r) => setTimeout(r, 2000));
  const r = await circle.getTransaction({ id: circleTxId });
  const state = r.data?.transaction?.state;
  console.log(`  [${i + 1}/30] state=${state ?? "(none)"}`);
  if (state === "COMPLETE") { onchainHash = r.data?.transaction?.txHash; break; }
  if (state === "FAILED" || state === "CANCELLED" || state === "DENIED") {
    console.error(`Registration failed: state=${state}`); process.exit(1);
  }
}
if (!onchainHash) { console.error("Polling timed out; check Circle dashboard."); process.exit(1); }
console.log(`On-chain tx: https://testnet.arcscan.app/tx/${onchainHash}`);

const publicClient = createPublicClient({ chain: ARC_TESTNET_CHAIN, transport: http() });
const latest = await publicClient.getBlockNumber();
const fromBlock = latest > 10000n ? latest - 10000n : 0n;
const logs = await publicClient.getLogs({
  address: IDENTITY_REGISTRY,
  event: parseAbiItem("event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)"),
  args: { to: ownerAddress },
  fromBlock,
  toBlock: latest,
});
if (logs.length === 0) { console.error("No Transfer event found for our wallet in the last 10k blocks."); process.exit(1); }
const tokenId = logs[logs.length - 1].args.tokenId.toString();

console.log("\nPaste into .env.local:");
console.log(`SELBO_AGENT_ID=${tokenId}`);
console.log(`SELBO_AGENT_REGISTRATION_TX=${onchainHash}`);
