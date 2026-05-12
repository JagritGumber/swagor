/**
 * One-time deployment script for the PortfolioDecisions anchor contract.
 *  1. Compiles contracts/yield_routing/PortfolioDecisions.sol via solc-js
 *  2. Deploys to Arc Testnet via Circle Smart Contract Platform SDK
 *  3. Polls getContract() until contractAddress is populated
 *  4. Writes NEXT_PUBLIC_ANCHOR_CONTRACT_ADDRESS to .env.local
 *
 * Run: node deploy-anchor-contract.mjs
 */
import { config } from "dotenv";
import { readFileSync, writeFileSync } from "fs";
import solc from "solc";
import { initiateSmartContractPlatformClient } from "@circle-fin/smart-contract-platform";

config({ path: ".env.local" });

const SOURCE_PATH = "contracts/yield_routing/PortfolioDecisions.sol";

console.log(`Compiling ${SOURCE_PATH} with solc ${solc.version()}`);
const source = readFileSync(SOURCE_PATH, "utf8");

const input = {
  language: "Solidity",
  sources: { "PortfolioDecisions.sol": { content: source } },
  settings: {
    optimizer: { enabled: true, runs: 200 },
    outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } },
  },
};
const compiled = JSON.parse(solc.compile(JSON.stringify(input)));

if (compiled.errors) {
  const fatal = compiled.errors.filter((e) => e.severity === "error");
  if (fatal.length > 0) {
    console.error("Compilation errors:");
    fatal.forEach((e) => console.error(e.formattedMessage));
    process.exit(1);
  }
  compiled.errors
    .filter((e) => e.severity === "warning")
    .forEach((w) => console.warn(w.formattedMessage));
}

const contract = compiled.contracts["PortfolioDecisions.sol"].PortfolioDecisions;
const bytecode = "0x" + contract.evm.bytecode.object;
const abi = contract.abi;
console.log(`Compiled. Bytecode ${bytecode.length} chars, ABI ${abi.length} entries.`);

const { CIRCLE_API_KEY, CIRCLE_ENTITY_SECRET, NEXT_PUBLIC_AGENT_WALLET_ID } = process.env;
if (!CIRCLE_API_KEY || !CIRCLE_ENTITY_SECRET || !NEXT_PUBLIC_AGENT_WALLET_ID) {
  console.error("Missing CIRCLE_API_KEY, CIRCLE_ENTITY_SECRET, or NEXT_PUBLIC_AGENT_WALLET_ID in .env.local");
  process.exit(1);
}

const sdk = initiateSmartContractPlatformClient({
  apiKey: CIRCLE_API_KEY,
  entitySecret: CIRCLE_ENTITY_SECRET,
});

console.log("Deploying to ARC-TESTNET via Circle Smart Contract Platform...");
const deployResp = await sdk.deployContract({
  name: "PortfolioDecisions",
  description: "Anchors AI agent portfolio decisions on Arc",
  walletId: NEXT_PUBLIC_AGENT_WALLET_ID,
  blockchain: "ARC-TESTNET",
  abiJson: JSON.stringify(abi),
  bytecode,
  fee: { type: "level", config: { feeLevel: "MEDIUM" } },
});

const contractId = deployResp.data?.contractId;
const transactionId = deployResp.data?.transactionId;
if (!contractId || !transactionId) {
  console.error("Deploy response missing contractId/transactionId. Full data:");
  console.error(JSON.stringify(deployResp.data, null, 2));
  process.exit(1);
}
console.log(`Deploy queued. contractId=${contractId} txId=${transactionId}`);
console.log("Polling getContract for confirmation (up to 5 min)...");

let contractAddress = null;
let errReason = null;
for (let i = 0; i < 60; i++) {
  await new Promise((r) => setTimeout(r, 5000));
  const resp = await sdk.getContract({ id: contractId });
  const c = resp.data?.contract;
  contractAddress = c?.contractAddress ?? null;
  errReason = c?.deploymentErrorReason ?? null;
  console.log(
    `  [${i + 1}/60] addr=${contractAddress ?? "(pending)"}${errReason ? ` err=${errReason}` : ""}`,
  );
  if (contractAddress) break;
  if (errReason) {
    console.error(`\nDeployment failed: ${errReason}`);
    process.exit(1);
  }
}

if (!contractAddress) {
  console.error("Polling timed out before contractAddress was set.");
  console.error("Check Circle dashboard: https://console.circle.com/web3-services/contracts");
  process.exit(1);
}

console.log(`\nDeployed at: ${contractAddress}`);

const envPath = ".env.local";
let env = readFileSync(envPath, "utf8");
const newLine = `NEXT_PUBLIC_ANCHOR_CONTRACT_ADDRESS=${contractAddress}`;
if (env.match(/^NEXT_PUBLIC_ANCHOR_CONTRACT_ADDRESS=.*/m)) {
  env = env.replace(/^NEXT_PUBLIC_ANCHOR_CONTRACT_ADDRESS=.*/m, newLine);
} else {
  env += `\n# Anchor contract on Arc Testnet (auto-populated)\n${newLine}\n`;
}
writeFileSync(envPath, env);
console.log("Wrote NEXT_PUBLIC_ANCHOR_CONTRACT_ADDRESS to .env.local. Restart dev server.");
