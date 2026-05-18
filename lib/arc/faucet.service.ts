import "server-only";

const CIRCLE_FAUCET_URL = "https://api.circle.com/v1/faucet/drips";

/**
 * Drip testnet USDC from Circle's public faucet to a freshly-created
 * user wallet. Fire-and-forget from ensureSelboInstance: failures land
 * in logs and leave the wallet empty so a later retry can fill it.
 *
 * Rate limits (per Circle docs as of 2026-05):
 *   - 20 USDC per address per blockchain every 2 hours
 *   - ~5-10 calls per API key per day
 * Implication: every new user gets a single drip (~20 USDC) at signup.
 * 1000+ USDC per user is not technically possible to auto-fund without
 * an operator-pre-funded seed wallet; the dashboard's $1000 simulated
 * balance remains the paper-trading number.
 */
export async function fundNewUserWalletFromFaucet(input: {
  walletAddress: string;
}): Promise<void> {
  const apiKey = process.env.CIRCLE_API_KEY;
  if (!apiKey) {
    console.warn("[faucet] CIRCLE_API_KEY not set; skipping new-user drip");
    return;
  }

  const res = await fetch(CIRCLE_FAUCET_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      address: input.walletAddress,
      blockchain: "ARC-TESTNET",
      usdc: true,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error(`[faucet] drip failed status=${res.status} body=${body.slice(0, 200)}`);
    return;
  }
  console.log(`[faucet] dripped testnet USDC to ${input.walletAddress}`);
}
