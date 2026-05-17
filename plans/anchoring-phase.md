# Selbo Anchoring + Brokerage Phase

## Context

7 days to demo (deadline 2026-05-25). The next demo lever is on-chain anchoring, framed for the Agora Agents Hackathon thesis: registered AI agent + every decision verifiable on Arc + earns real broker fees in USDC.

Three blocks ship in order behind a Public Track Record page:

1. ERC-8004 identity registration so Selbo has an on-chain agent ID + reputation surface.
2. Daily Analysis + Backtest anchoring through the existing PortfolioDecisions contract.
3. BrokerFee: direct Circle USDC transfer from user wallet to Selbo wallet on each closed trade.

x402 was considered for the broker-fee surface and rejected: x402 is synchronous request-response (server returns 402 -> client signs -> retry). Selbo closes trades autonomously while the user is asleep, so there is no client to sign per close. Direct Circle Dev Wallet transfers fit the autonomous flow and stay simple.

## Locked decisions

- Reuse the existing PortfolioDecisions contract for daily / backtest / trade anchors. Same ABI `anchorDecision(bytes32,bytes32,bytes32,string,string)`. New tag-string prefixes only: `analysis:YYYY-MM-DD`, `backtest:RUN_ID:YYYY-MM-DD`. No Solidity work.
- ERC-8004 identity: register at `0x8004A818BFB912233c491871b3d84c89A494BD9e` (IdentityRegistry on Arc Testnet) with metadata URI pointing to a self-hosted JSON blob. One-time. Token ID goes into env as `SELBO_AGENT_ID`.
- Broker fee per closed trade = `min(usdcWei(0.10), sizeUsd * 0.02)` rounded to 6 decimals (USDC ERC-20 interface).
- Direct Circle `createTransaction` from the user Circle wallet to Selbo's wallet on the USDC ERC-20 interface `0x3600000000000000000000000000000000000000`. Gas is sponsored ($0).
- Trade close path stays the same on PnL/equity calculations. Broker fee is recorded in a separate `broker_fees` table; it does NOT subtract from user PnL display in v1 (the fee mechanic is demo-symbolic on testnet -- a "no real funds" disclaimer covers it).
- Public Track Record page is unauthenticated, lives at `/track-record`, and is the single best-link demo asset.
- All UI shows arcscan links. Base: `https://testnet.arcscan.app/tx/{hash}` + `/address/{addr}`.

## What already exists (reuse)

- `lib/arc/anchor.ts`: Circle SDK integration + 4 anchor functions (cycle, open trade, close trade, watcher) + `pollPendingAnchors()` heartbeat poller.
- `contracts/yield_routing/PortfolioDecisions.sol` already deployed; `NEXT_PUBLIC_ANCHOR_CONTRACT_ADDRESS` + `NEXT_PUBLIC_AGENT_WALLET_ID` are in env.
- `trades` schema has `arcAnchorTx`, `arcOnchainTxHash`, `openAnchorTx`, `openOnchainTxHash`. `monitor_ticks` similar pair.
- `daily_plans` and backtest tables exist but have NO anchor columns yet.
- USDC contract on Arc Testnet ERC-20 interface: `0x3600000000000000000000000000000000000000` (6 decimals).

## Slice 0: anchor.ts refactor (~3h) -- P2 cleanup, no behavior change

The current `lib/arc/anchor.ts` is 399 lines (4x cap). Split into focused modules; the public surface stays identical via a barrel.

### Files

- `lib/arc/sdk.ts` (NEW, ~30 lines): `getSdk()`, `sha256Hex`, `AnchorJsonValue`, `uuidToBytes32`.
- `lib/arc/anchor-cycle.ts` (NEW, ~50 lines): `anchorCycle` + `AnchorResult` type.
- `lib/arc/anchor-trade.ts` (NEW, ~95 lines): `anchorOpenedTrade` + `anchorClosedTrade` + their input/result types.
- `lib/arc/anchor-watcher.ts` (NEW, ~50 lines): `anchorWatcherDecision` + types.
- `lib/arc/poll-pending-anchors.ts` (NEW, ~95 lines): factor `pollPendingAnchors` into per-source helpers. Internal `resolveCircleTx` helper lives here. Sources: trades-close, trades-open, watcher (existing) + a registry pattern so Slice 2 and Slice 3 can plug in.
- `lib/arc/anchor.ts` (UPDATE, ~15 lines): barrel re-export.
- Call sites (no functional change): `app/services/watcher/watcher.service.ts`, `app/api/watcher/tick/route.ts`, `app/services/trades/paper-trade.service.ts` -- imports change from `lib/arc/anchor` to the new specific module or stay on the barrel; same names.

### Verification

- `bun run typecheck` clean.
- Force-close a paper trade; verify on-chain hash still resolves end-to-end (no behavior change).

## Slice 1: ERC-8004 identity registration (~3h)

### Files (each <100 lines)

- `scripts/register-selbo-agent.mjs` (NEW, ~80 lines): one-shot script using `@circle-fin/developer-controlled-wallets`. Calls `register(string)` on IdentityRegistry, polls until COMPLETE, fetches the minted token ID by reading `Transfer` events with `to=ownerWallet.address`, prints `SELBO_AGENT_ID` + tx hash for the user to paste into `.dev.vars`.
- `public/selbo-agent.json` (NEW, ~25 lines): static metadata blob. Fields: `name`, `description`, `agent_type=trading`, `capabilities[]`, `version`, `image=null`. Served by Next.js as `https://selbo.app/selbo-agent.json` and passed as the metadata URI.
- `.env.example` (UPDATE): add `SELBO_AGENT_ID=` placeholder, `SELBO_AGENT_REGISTRATION_TX=` placeholder, `SELBO_AGENT_METADATA_URI=` placeholder with comment block explaining the registration is one-time, run via `bun run scripts/register-selbo-agent.mjs`.

### Notes

- Per Arc docs: gas on Agent Wallets is sponsored ($0). Doc quote: "Onchain transactions on agent wallets are gas-sponsored at no cost to you." Registration tx is ~0.006 USDC-equivalent regardless.
- ERC-8004 is mint-once. Re-running the script is idempotent on the wallet level (would mint a second token); the script bails if `SELBO_AGENT_ID` is already set in env.

## Slice 2: Daily + Backtest anchoring (~6h)

### Schema deltas

- `lib/db/schema/daily-plans.ts` (UPDATE, +2 columns, file stays <50 lines): add `arcAnchorTx text` + `arcOnchainTxHash text`. Both nullable. App-level relation only.
- `lib/db/schema/backtest-runs.ts` (UPDATE, +2 columns): same two columns at the run level (anchors the whole run's manifest once).
- `lib/db/migrations/0013_anchor_columns.sql` (NEW): two ALTER TABLEs. Idempotent (`IF NOT EXISTS`).

### Anchor functions

- `lib/arc/anchor-analysis.ts` (NEW, ~70 lines): `anchorDailyAnalysis({ planId, generatedAt, planJson })` and `anchorBacktestAnalysis({ runId, planId, asOfDate, planJson })`. Both wrap `anchorDecision` with tag = `analysis:YYYY-MM-DD` or `backtest:RUNID:YYYY-MM-DD`. `verdict` carries a short summary string (`"long BTC 60% conv, short ETH 45% conv"`). `swarmTraceHash = sha256(planJson)`. `graphSnapshotHash = zero bytes32`.
- `lib/arc/anchor.ts` (UPDATE): no new functions; just export `sha256Hex` already present and the SDK getter.
- `app/services/swarm/daily-planner.service.ts` (UPDATE, ~5 lines added): on successful plan completion, fire-and-forget `anchorDailyAnalysis(...).catch(logErr)`. Save tx id back into `daily_plans.arcAnchorTx` in the same query that flips status to `complete`.
- `app/services/backtest/run-backtest-day.service.ts` (UPDATE, ~5 lines added): same pattern, calls `anchorBacktestAnalysis(...)`.
- `lib/arc/poll-pending-anchors.ts` (NEW, ~80 lines): factor the existing `pollPendingAnchors` body into named helpers per source (trades-close / trades-open / watcher / daily-plans / backtests). Keep `anchor.ts` slim by reexporting from the new file. The current 399-line `anchor.ts` is a pre-existing 100-line violation we'll partially address here.

### Notes

- Refactoring `anchor.ts` end-to-end is OUT of scope. Move only the polling logic out so we stay under-budget. Acknowledge that `anchor.ts` itself is still over-cap; will note in the PR description.

## Slice 2.5: Anchor backfill + gas-sponsorship preflight (~2h)

### Files

- `scripts/anchor-backfill.mjs` (NEW, ~70 lines): one-shot. Selects `daily_plans` where `arcAnchorTx IS NULL AND status='complete'`, calls `anchorDailyAnalysis(...)` for each, writes the result back. Same for `backtest_runs`. Idempotent (skips rows already anchored). Logs a summary line per row.
- `docs/gas-sponsorship-preflight.md` (NEW, ~30 lines): runbook for the 24h gas-sponsorship test. Sequence: enable Selbo for a clean account, force-run daily + backtest, open ~10 trades, watch heartbeat poller logs for sponsorship-cap errors. Document escape hatches.

### Notes

- Backfill is run by the user via `bun run scripts/anchor-backfill.mjs` before demo day; this is captured in `MEMORY.md` rules: db:push + deploy are user-owned actions.

## Slice 3: BrokerFee direct Circle transfer (~4h)

### Schema deltas

- `lib/db/schema/broker-fees.ts` (NEW, ~45 lines): `id uuid pk`, `userId text`, `tradeId uuid references trades(id) on delete set null` with a **UNIQUE index on tradeId** for idempotency, `feeUsd numeric(20,6) not null`, `pnlUsdAtClose numeric(20,6)`, `circleTxId text`, `onchainTxHash text`, `createdAt timestamptz default now()`.
- `drizzle.config.ts` (UPDATE): add `broker_fees` to `tablesFilter` so `db:push` picks it up. Per memory rule [[feedback_drizzle_tables_filter]].
- `lib/db/migrations/0014_broker_fees.sql` (NEW): CREATE TABLE + index on `userId` + index on `tradeId`.

### Service

- `app/services/brokerage/charge-fee.service.ts` (NEW, ~85 lines): `chargeBrokerFee({ userId, tradeId, sizeUsd, pnlUsd })`. **Idempotency: first runs `INSERT INTO broker_fees (...) ON CONFLICT (trade_id) DO NOTHING RETURNING id`**. If RETURNING is empty, a fee for this trade already exists -- short-circuit and return. Otherwise reads user's Circle wallet from `selboInstance`, computes `fee = min(0.10, sizeUsd * 0.02)`, calls `circle.createTransaction({ walletAddress: userWallet, blockchain: "ARC-TESTNET", tokenAddress: "0x3600000000000000000000000000000000000000", destinationAddress: process.env.SELBO_TREASURY_WALLET_ADDRESS, amount: [feeStr] })`, updates the row with the Circle tx id. Returns `{ feeUsd, circleTxId }`.
- `app/services/trades/paper-trade.service.ts` (UPDATE, ~3 lines added): after status flips to `closed` and PnL is written, fire-and-forget `chargeBrokerFee(...).catch(logErr)`.
- `.env.example`: add `SELBO_TREASURY_WALLET_ADDRESS=` placeholder with comment "EVM address that receives broker fees. Set after `bun run scripts/register-selbo-agent.mjs`."

### Notes

- "Skip if user has no Circle wallet" path: if `userCircleWalletAddress` is null/undefined, log a skipped-fee event and return. Do NOT block the trade close.
- Fee in USDC ERC-20 interface decimals = `BigInt(Math.round(fee * 1_000_000))`.
- Polling for broker-fee tx → onchain hash piggybacks on the existing heartbeat. Add a fifth source to `pollPendingAnchors`: `broker_fees` where `circleTxId NOT NULL AND onchainTxHash NULL`.

## Slice 4: UI on-chain badges (~6h)

### Files

- `components/ui/arc-tx-link.tsx` (NEW, ~25 lines): server-safe React component. Props: `txHash: string | null | undefined`. Renders an arcscan link with a copy-hash chip when present; renders a small "pending" badge while only the Circle queue id is known; renders nothing when both are null. Memoized.
- `components/dashboard/bento/daily-plan.tsx` (UPDATE, ~3 lines added): add `<ArcTxLink txHash={plan.arcOnchainTxHash} />` in the header next to the date.
- `components/dashboard/bento/trades-table.tsx` (UPDATE, ~6 lines added): two columns -> open hash + close hash, each an `ArcTxLink`.
- `components/dashboard/bento/backtest-run-view.tsx` (UPDATE, ~3 lines added): one badge per daily analysis row.

### Notes

- No new state. Read `arcOnchainTxHash` from existing fetches. Confirm the row already includes the field in the API responses; update select clauses if not.

## Slice 5: Public Track Record page (~6h)

### Files

- `app/track-record/page.tsx` (NEW, ~80 lines): server component. Reads latest 50 days of `daily_plans` where `selboInstanceId=DEMO_INSTANCE_ID` and `backtestRunId IS NULL` and `status='complete'`. Reads latest closed backtest run. Computes equity curve from trades closed on the demo instance. Renders bento with 4 cells: agent ID badge + arcscan, equity sparkline, win rate big-number, anchored-analyses list.
- `app/track-record/_components/track-record-header.tsx` (NEW, ~40 lines): client component. Renders Selbo's metadata (`/selbo-agent.json`), ERC-8004 IdentityRegistry link, and total anchored decision count.
- `app/track-record/_components/anchored-analyses-list.tsx` (NEW, ~60 lines): scrollable list of date + verdict + arcscan link.
- `app/track-record/_components/equity-sparkline.tsx` (NEW, ~40 lines): tiny SVG sparkline (no library), starting from $1000 baseline.
- `.env.example`: add `DEMO_INSTANCE_ID=` placeholder with comment "Selbo instance whose data is shown on the public /track-record page."

### Notes

- No auth gating on this page. Pure read.
- Skip any heavy chart libs. SVG line via path.
- "Anchored" badge only when the row has `arcOnchainTxHash`. While it's still pending (Circle queued, on-chain unresolved) show a quiet "anchoring..." spinner -- judges will still see most rows as fully anchored.

## Verification

1. `bun run typecheck` clean across all slices.
2. Run `bun run scripts/register-selbo-agent.mjs` once. Confirm a token ID is minted and `SELBO_AGENT_ID` is populated. Click the tx link in arcscan.
3. Force-run a daily plan via the existing admin route. Confirm `daily_plans.arcAnchorTx` lands within ~3s. Within ~5s `arcOnchainTxHash` resolves via the heartbeat poller. Brain page Analysis card shows the arcscan link.
4. Force-run a 30-day backtest. Confirm each daily backtest plan gets anchored. Backtest view shows badges per row.
5. Close a paper trade. Confirm a `broker_fees` row is created. The Selbo treasury wallet's USDC balance ticks up by `min(0.10, size*0.02)`. The broker-fees poller resolves the on-chain hash within ~5s.
6. Open `/track-record` while signed out. Verify the page renders without auth and links work.

## Out of scope

- x402 paywalls. Per user instruction "make it simple for starters."
- ERC-8183 job lifecycle. Selbo is a perp trader, not a service provider; ERC-8183's client/provider/evaluator triad with USDC escrow per analysis doesn't fit.
- Reputation Registry writes. Future phase; ERC-8004 alone gives us identity + a stable agent ID.
- IPFS pinning of the full reasoning trace. The hash on-chain is sufficient for v1; rehydration via IPFS is a v1.5 nice-to-have.

## P0/P1/P2 self-review (pre-approval)

**P0 -- correctness risks**

- *Broker-fee idempotency.* If `chargeBrokerFee` is fire-and-forget and the close path is retried, we could double-charge. **Mitigation:** the `broker_fees` table gets a unique index on `tradeId`. The service starts with `INSERT ... ON CONFLICT (trade_id) DO NOTHING`; if a row already exists, return its `circleTxId` without dispatching a second Circle tx.
- *anchoredAt vs generatedAt.* If anchor fails permanently, we should NOT block the daily plan from being marked `complete`. Confirmed in design: anchor is fire-and-forget; failure logs only.

**P1 -- demo risks**

- *Public Track Record page shows zero anchored rows for the first N hours after deploy* because anchors are async. **Mitigation:** the page surfaces both "anchored" (with link) and "anchoring..." (pending) badges; we backfill anchors for historical `daily_plans` via a one-shot script before the demo.
- *Selbo treasury wallet might run dry on gas / paymaster cap.* Per docs "Sponsorship is capped, subject to fair use." For demo-scale (~30 trades/day) this is comfortably inside fair-use, but we should confirm by running the first 24h in advance.

**P2 -- cleanup**

- Existing `anchor.ts` is 399 lines, far over the 100-line cap. **Slice 0 brings the whole module under the cap** by splitting into focused submodules with a barrel re-export.
- `pollPendingAnchors` adopts a per-source registry pattern in Slice 0 so Slice 2 (daily/backtest) and Slice 3 (broker fees) plug in via a single line.
