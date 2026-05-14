# Arc Testnet Ecosystem Verification (M0)

Day 0 verification for Selbo v4. Conducted 2026-05-12 by research worktree.
Source of truth for all other worktrees. If anything here is wrong, update this file first.

---

## Chain configuration

| Field | Value | Source |
|---|---|---|
| Network | Arc Testnet | Circle docs |
| Chain ID | 5042002 | `node_modules/viem/chains/definitions/arcTestnet.ts` (canonical) |
| RPC URL | https://rpc.testnet.arc.network | viem chain def |
| Native gas token | USDC (18 decimals on Arc) | `docs.arc.network/llms.txt` |
| Block explorer | https://testnet.arcscan.app | Circle docs |
| Status | Public testnet, mainnet beta planned 2026 | Circle press release |

---

## The 6 D0 questions

### Q1: Is Uniswap V3 (or any usable DEX) deployed on Arc Testnet?

**Status: NOT CONFIRMED on the canonical contract-addresses page.**

- Arc docs contract list does NOT include `SwapRouter02`, `NonfungiblePositionManager`, or any Uniswap V3 addresses
- `Permit2` IS deployed (`0x000000000022D473030F116dDEE9F6B43aC78BA3`) — used by Uniswap but doesn't imply Uniswap V3 itself is deployed
- Web search confirms Uniswap Labs as an Arc ecosystem partner but specific Arc Testnet deployment is not announced
- Curve is also mentioned as an ecosystem participant; no testnet deployment confirmed in canonical docs

**Decision for Selbo v4:** Doesn't block the build. v4 is simulation-only — Executor uses **mainnet Uniswap pool spot prices** (via subgraph or pool `slot0()`) for simulated entry/exit. No on-chain Uniswap call on Arc needed. Live mode (post-hackathon) would route via CCTP V2 hop to Ethereum/Base + execute on Uniswap there.

**Action item:** before live-mode flip, re-verify or contact Arc team for DEX status.

---

### Q2: Is USYC live on Arc Testnet?

**Status: CONFIRMED YES.**

Deployed contracts on Arc Testnet:
- **USYC token:** `0xe9185F0c5F296Ed1797AaE4238D26CCaBEadb86C`
- **USYC Entitlements:** `0xcc205224862c7641930c87679e98999d23c26113`
- **USYC Teller:** `0x9fdF14c5B14173D74C08Af27AebFf39240dC105A`

**Decision for Selbo v4:** Selbo can propose "park idle USDC into USYC" as a low-conviction trade. Teller contract handles the USDC↔USYC conversion. Earns Treasury yield on idle capital between active trades. Same trade pipeline (proposal → council → critic → executor → anchor) treats it as a normal proposal.

---

### Q3: Is Arc in CCTP V2's supported chain list?

**Status: CONFIRMED YES (testnet only).**

- **Domain ID:** 26
- **Standard Transfer:** ✅ supported
- **Fast Transfer:** ❌ not supported on Arc Testnet
- **Forwarding Service:** ✅ supported

CCTP V2 contracts on Arc Testnet:
- **TokenMessengerV2:** `0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA`
- **MessageTransmitterV2:** `0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275`
- **TokenMinterV2:** `0xb43db544E2c27092c107639Ad201b3dEfAbcF192`
- **MessageV2:** `0xbaC0179bB358A8936169a63408C8481D582390C4`

**Decision for Selbo v4:** Out of scope for simulation v1. Available as future stretch for live cross-chain trading. If used: budget 30s-2min per attestation, no Fast Transfer on Arc, never resubmit a successful burn (per plan §3.6 CCTP attestation handling).

---

### Q4: Is EURC live on Arc Testnet?

**Status: CONFIRMED YES.**

**EURC token:** `0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a`

**Decision for Selbo v4:** Multi-currency features ARE possible. Out of scope for v1 (USDC only), but future Selbo strategies could propose EURC trades or USDC↔EURC FX rotations. Keep schema flexible (already use `asset text` not `usdc only`).

---

### Q5: Circle Developer-Controlled Wallets working on Arc Testnet (sandbox tier)?

**Status: CONFIRMED YES — already in use.**

Evidence from existing repo state:
- `setup-entity-secret.mjs` script generated RSA-4096 entity secret ciphertext successfully
- `generate-wallet.mjs` (or equivalent) created Jagrit's owner Circle wallet on Arc Testnet
- Anchor contract `0x09da34f9bf0129927084b39061dac4e5dabf0818` deployed via Circle SCP using Dev Wallet
- `lib/utils/developer-controlled-wallets-client.ts` is wired and working

**Decision for Selbo v4:** Per-user provisioning will use the same SDK. Each new user gets a Circle Dev Wallet on signup. Sandbox tier is FREE — no per-wallet cost.

---

### Q6: Arc Testnet USDC faucet — programmatic API + rate limit?

**Status: PARTIAL — public faucet works; programmatic API exists but specifics need confirmation.**

**Public faucet (web UI):**
- URL: https://faucet.circle.com (supports Arc Testnet)
- Rate limit: **20 USDC per address per 2 hours** per blockchain
- Per IP: 3 claims per 24 hours
- No account required for public faucet

**Programmatic faucet API:**
- Circle Developer Console offers programmatic faucet access (per-key limits, ~5-10 claims/day per key per search results)
- Exact endpoint + auth shape needs confirmation from Circle SDK docs
- Auto-provisioning flow would call this on user signup

**Decision for Selbo v4:** Use Circle Developer Console programmatic faucet for auto-provisioning. If rate-limited or unavailable, fall back to **tracking high simulated balance in DB independent of on-chain wallet balance** (default 1000 simulated USDC per new user). Wallet still exists on-chain (anchor events tied to it); simulated balance is just a database number for trade sizing.

**Action item for backend worktree (M2):** confirm programmatic faucet endpoint + auth via Circle Developer Console docs or SDK source. If neither, fall back to simulated-balance-only.

---

## Bonus findings — other Arc Testnet contracts available

| Contract | Address | Use case |
|---|---|---|
| USDC | `0x3600000000000000000000000000000000000000` | Native gas token, system address |
| Gateway Wallet | `0x0077777d7EBA4688BDeF3E311b846F25870A19B9` | Circle Gateway product (unified balance) |
| Gateway Minter | `0x0022222ABE238Cc2C7Bb1f21003F0a260052475B` | Circle Gateway product |
| FxEscrow | `0x867650F5eAe8df91445971f14d89fd84F0C9a9f8` | USDC↔EURC FX settlement (out of scope for v1) |
| Permit2 | `0x000000000022D473030F116dDEE9F6B43aC78BA3` | Gasless approvals |
| Multicall3 | `0xcA11bde05977b3631167028862bE2a173976CA11` | Batched reads (useful for dashboard) |
| CREATE2 Factory | `0x4e59b44847b379578588920cA78FbF26c0B4956C` | Deterministic contract deploys |

---

## Implications for plan v4

| Plan section | Status after M0 |
|---|---|
| §1 product (simulation-only) | UNCHANGED — Q1 result confirms no on-chain DEX needed |
| §3.0 user provisioning | UNCHANGED — Q5 confirms Dev Wallets work |
| §3.6 Executor (simulation against mainnet pool spot) | UNCHANGED — Q1 result means no Arc-DEX execution needed |
| §3.8 Anchor (TradeAnchored event on Arc) | UNCHANGED — existing contract deployment works |
| §6 cost model | UNCHANGED — wallet creation $0, faucet $0, LLM ~$10 |
| **Idle USYC parking (NEW positive)** | Q2 confirms USYC live on Arc. Selbo can propose USYC trades via the Teller contract. Add to §2 "Idle USYC management" capability. |
| **EURC features (FUTURE positive)** | Q4 confirms EURC live. Out of v1 scope but available for v2 multi-currency. |
| **Faucet auto-provisioning** | Q6 partial — needs M2 backend worktree to confirm programmatic API. Fall back to simulated balance if needed. |

---

## Greenlight summary

✅ Q2 USYC — full yes, deployed
✅ Q3 CCTP V2 testnet — full yes, domain 26
✅ Q4 EURC — full yes, deployed
✅ Q5 Circle Dev Wallets — full yes, already working
⚠️ Q1 DEX — not confirmed, but doesn't block simulation v1
⚠️ Q6 Faucet API — public faucet works (20 USDC / 2h); programmatic API needs M2 confirmation, fallback path defined

**Result: M0 complete. Backend, executor, frontend worktrees are unblocked once M1 (schema) and M1.5 (contract tests) land.**

---

## Sources

- [Arc canonical contracts](https://docs.arc.network/arc/references/contract-addresses) — addresses for USDC, USYC, EURC, CCTP V2 contracts, Gateway
- [Arc docs llms.txt](https://docs.arc.network/llms.txt) — chain config, USDC as gas
- [Circle CCTP supported chains](https://developers.circle.com/cctp/cctp-supported-blockchains) — Arc domain 26, Standard Transfer only
- [Circle Arc Testnet launch press release](https://www.circle.com/pressroom/circle-launches-arc-public-testnet)
- [Circle testnet faucet](https://faucet.circle.com) — public faucet web UI
- [Circle Q1 2026 product vision](https://www.circle.com/blog/building-the-internet-financial-system-circles-product-vision-for-2026) — USYC + EURC roadmap context
- viem `arcTestnet` chain definition (local node_modules) — chain ID 5042002, RPC URL
- Repo existing files: `lib/web3/chains.ts`, `lib/protocols/arc-usdc.ts`, `setup-entity-secret.mjs`, `deploy-anchor-contract.mjs` — confirm Circle Dev Wallets + SCP working
