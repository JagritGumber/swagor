# Selbo

> **Selbo V2 (in-progress)**: a standalone RL agent. V2 does NOT touch this Next.js watcher/trader flow. V2 is greenfield: separate directory/service, scheduled by **cron-job.org** (NOT Vercel cron, NOT Inngest). "Selbo IS the model" - the RL agent itself is the product, not a wrapper around the existing V1 system.
>
> **Branch strategy**: `main` (this branch) deploys to selbo.app and is the stable submitted version. All V2 work happens on `dev`, which deploys to dev.selbo.app. Until V2 is ready to replace V1, expect main to stay roughly as-is.

Selbo (V1) is an autonomous perpetual futures trading agent. It runs 24/7 per user on Hyperliquid testnet, reads market state and risk continuously, and asks AI agents to decide when to open, close, hedge, or hold positions. Every decision is recorded, every trade is anchored on Arc, and the user can read the full reasoning behind any action Selbo takes.

Built for the Agora Agents hackathon (Canteen x Circle x Arc, 2026-05-11 to 2026-05-25) against **RFB 01: Perpetual Futures Trading Agent**. The submission target is paper-mode autonomy with transparent risk + reasoning logs, simulated PnL and drawdown, and Arc-anchored decision records.

> **Paper mode only.** No real funds at risk. No financial advice. Selbo is a hackathon experiment, not a regulated product. See the in-app ToS gate and `/legal/disclaimer`.

## How Selbo maps to RFB 01 judging criteria

The Agora Agents rubric scores four dimensions. This section maps each one to specific code, on-chain artifacts, and shipped behavior so the evidence is extractable rather than narrative.

### Agentic Sophistication

**Claim:** Selbo is fully autonomous. Every trade decision is the agent's. No hardcoded discipline gates, no preset playbook, no multi-choice scoring.

**Evidence:**
- Single LLM call writes the entire decision per tick: direction, size, leverage, stop, take-profit, plain-English reasoning, confidence, next-check cadence. See `app/services/watcher/selbo-agent-decision.ts` (the `decideSelboTick` function) and `app/services/watcher/agent-prompt.ts` (the trader prompt + output schema).
- The discipline-gate stack was deliberately removed. Prior versions had `SCALPER_MAX_*` constants, `setupBlocks`, `countertrendBlocks`, confidence floors, and a `scalper-long-discipline.ts` rule engine. All deleted in the agentic-Selbo pivot (see git history for `app/services/watcher/scalper-long-discipline.ts` deletion). The watcher engine that wrapped them was also stripped, leaving only the agent-decides path.
- The agent prompt invites free reasoning over structural inputs (volume profile, value area, regime, recent candles, open-interest flow, funding state) and returns JSON-validated freeform thinking — not a multi-choice classification.
- The agent self-evolves via the setup-fingerprint primitive: every closed trade increments a per-(asset, side, value_location, volume_state, oi_flow, funding_state) record. After three trades on the same setup, the agent reads its own empirical W/L, avg R-multiple, lossesByReason breakdown, and state-shift counts before the next decision. See `app/services/setup-fingerprint/` and `lib/db/schema/setup-records.ts`.
- Backtest demonstrated the agent's behavior shifts in response to the record: BTC|short win rate improved from 33% pre-gate to 44% post-gate over 12 trades in the 8-week 2026-03-01 to 2026-04-30 backtest, with avg loss size dropping from -$2.15 to -$0.52.

### Traction

Submitted via the Agora Google Form. The public flagship dashboard at [selbo.app/track-record](https://selbo.app/track-record) surfaces live decisions, anchored trades, and lifetime performance updated in real time as the agent runs.

### Circle Tool Usage

**Claim:** Two distinct creative uses of Circle's developer platform.

**Evidence:**
- **Developer-Controlled Wallets per user, via the entity-secret pattern.** Each Selbo user is auto-provisioned a Circle Dev Wallet on signup. The agent signs every trade anchor and trade-open anchor from the user's own wallet, not a service account, with no per-transaction human approval required. This is non-trivial for autonomous agent flows: standard wagmi-style approval-per-tx would break the loop. See `app/services/selbo-instance.service.ts` for wallet provisioning and `lib/arc/anchor.ts` for signing.
- **Smart Contract Platform for the anchor contract.** The PortfolioDecisions contract on Arc Testnet was deployed via Circle's Smart Contract Platform tooling and is source-verified on Arcscan. Address: `0xa92913539d7fbed157974a08293b2620ac0d0277`. See `contracts/yield_routing/PortfolioDecisions.sol` and `lib/arc/anchor.ts` for the event emission path.
- **USDC on Arc as the brokerage-fee settlement asset.** A min($0.10, sizeUsd * 2%) USDC fee per closed trade routes from the user's Circle wallet to the Selbo treasury wallet (also Circle-Dev-Wallet-backed), idempotent via a unique index on `broker_fees.trade_id`. See `app/services/brokerage/charge-fee.service.ts`.

### Innovation

**Claim:** Three concrete research/engineering contributions, each shipped and verifiable.

**Evidence:**
- **Setup-fingerprint primitive replacing prose lessons.** Earlier iterations had a LIGHT LLM extracting one-sentence "lessons" after each closed trade that the agent then rationalized around. Replaced with a structured ledger keyed on the exact perp-tape configuration (asset, side, value location, volume state, open-interest flow, funding regime). Records gate at N>=3 trades before being exposed to the agent, so the agent never reads low-sample noise. Real R-multiples (sumR / rTrades, not pnl/notional). Both `winsAfterStateShift` and `lossesAfterStateShift` tracked, no selection bias. Backtest behavioral validation in `scripts/test-logic.ts` (66 parity assertions covering the in-memory mirror against live SQL upsert semantics). See `app/services/setup-fingerprint/index.ts`, `lib/db/schema/setup-records.ts`, and PR #176.
- **Hash-bound on-chain reasoning.** Every Selbo decision SHA-256 hashes the full agent context (market features, positions, risk snapshot, agent rationale) and anchors that hash on Arc via the PortfolioDecisions contract. The full off-chain reasoning is stored in Postgres; the hash binds it to the on-chain record forever. The agent cannot revise what it did after the fact. See `lib/arc/anchor.ts::sha256Hex` and the `swarmTraceHash` parameter of `anchorWatcherDecision`.
- **Identical-logic backtest.** The same `decideSelboTick` function drives both live trading and historical replay. Backtest cost (~$0.15 per 60-day run via Mistral-Small on DeepInfra) is accepted as the price of fidelity. No fake-faster backtest with cheaper logic. See `app/services/backtest/watcher-tick-step.ts` calling the same agent function, and `scripts/test-logic.ts` parity assertions on the fingerprint aggregation between SQL and in-memory paths.

### RFB 01 architecture alignment

Per the RFB 01 brief and confirmed by the organizer: Arc does NOT match orders; the brief frames Arc as the settlement chain across existing perp markets. Selbo executes on Hyperliquid testnet (publicly documented EIP-712 + matcher), Circle Dev Wallets sign every decision, and Arc anchors the reasoning hash. This is the brief's intended architecture, not a workaround.

## What the user sees

The dashboard is one viewport (1440x900 target), 12-col bento grid:

- **Activity tape**: chronological stream of every watcher tick, trade open, and trade close.
- **Balance + risk** tile: current equity, 24h delta, risk status, closest liquidation buffer, margin usage.
- **Price chart with trade markers**: trade entries and exits overlaid on a TradingView chart. Click a marker to open the decision drawer.
- **Equity history** area chart: 1D / 7D / 30D wallet curve.
- **Strategy chat** drawer: refine the strategy in plain English; Selbo replies with a one-sentence acknowledgment. The next watcher tick uses the new strategy.
- **Setup-record** disclosure: per-(asset, side, market-tape) empirical performance ledger. Read by the agent before each decision once a record crosses 3 trades. Replaces the prior prose-lessons system the agent rationalized around.
- **Decision drawer** (per trade): full reasoning trail. Agent rationale, market features at decision time, risk read, deterministic safety-rail outcome, Arc anchor links.

Below the fold (collapsed disclosures): Market state, Trade history, Arc anchors, Lifetime stats, Decisions (cycle traces), Dev controls (admin).

## Architecture

```text
cron-job.org tick
  -> Build market snapshot (Hyperliquid mids + funding + OI + candles + value profile)
  -> Pre-fetch agent's setup-record map (read-only)
  -> Risk Engine gate (deterministic; emergency bypass routes straight to safety rails)
  -> decideSelboTick (single LLM call: direction, size, leverage, stop, TP, reasoning)
  -> executeWatcherDecision (paper trade on Hyperliquid testnet mid)
  -> recordOutcome (setup-record upsert on close, atomic via onConflictDoUpdate)
  -> anchorWatcherDecision (SHA-256 of full context, anchored on Arc via Circle Dev Wallet)
```

One agent, one decision per tick. No upstream rule engine, no downstream auditor. The agent reads structured market state (volume profile, value area, regime, OI flow, funding state, recent candles, open positions, risk state, its own setup-record on the prospective side) and writes the entire decision in one LLM call. Strategy text passes through raw end-to-end. Critical risk (margin/liquidation) bypasses the LLM and routes straight to deterministic safety rails. Backtest uses the identical `decideSelboTick` function so the historical record matches what the live agent would have done.

## Status

- Stage: hackathon build, paper-mode only.
- Venue: Hyperliquid testnet for market data; simulated execution against mark prices.
- Custody: zero. Circle Developer-Controlled Wallet per user on Arc Testnet for anchor txs only.
- Audit: closed trades + watcher decisions are anchored to Arc Testnet via Circle Smart Contract Platform.
- Transparency: every trade row links to a decision drawer with the full reasoning trail.
- Legal: signup gates the dashboard behind a paper-mode disclaimer; full disclaimer at `/legal/disclaimer`.

## Tech stack

- Next.js 15 + React 18 + TypeScript 5.3 + Tailwind 4
- Drizzle ORM + Supabase Postgres
- Better Auth + Polar billing
- Circle Developer-Controlled Wallets + Circle Smart Contract Platform
- Hyperliquid testnet for market data
- TradingView lightweight-charts for price + equity charts
- Vercel (Next.js production deploy)
- LLM tier mapping configured via env; see `.env.example`

Typechecker: `tsgo` (`@typescript/native-preview`), the Go reimplementation of `tsc`.

## Development

```bash
bun install
cp .env.example .dev.vars
bun run db:push
bun run dev
```

Local app runs at `http://localhost:3000`. The dashboard is at `/dashboard`. Production is deployed via Vercel.

## Quality gates

```bash
bun run typecheck
```

CI runs typecheck on every push and pull request via `.github/workflows/typecheck.yml`.

## Project layout

- `app/services/risk-engine.service.ts`: deterministic perp risk snapshot and emergency action classification (margin pressure, liquidation distance, equity health).
- `app/services/watcher/`: the agent loop. `decideSelboTick` is the single LLM call per tick; `selbo-agent-decision.ts` is the entry point; `agent-prompt.ts` holds the trader system prompt + JSON output schema; `agent-payload.ts` builds the compact payload (market structure + setup-record lookup); `execute-watcher-decision.ts` runs the agent's chosen action (open / close / hold) on the paper executor.
- `app/services/setup-fingerprint/`: structured learning primitive. Per (asset, side, value_location, volume_state, oi_flow, funding_state) records the agent's empirical EV (W/L, avg R-multiple, lossesByReason, wins/losses-after-state-shift). N>=3 gate before exposure. Replaces the prose-lessons system the agent rationalized around.
- `app/services/trades/paper-trade.service.ts`: paper execution against Hyperliquid testnet mid, safety-trigger enforcement, brokerage-fee charge via Circle wallet, setup-record upsert on close, Arc anchor handoff.
- `app/services/backtest/`: historical replay using the IDENTICAL `decideSelboTick` agent function. `watcher-tick-step.ts` drives one hourly tick; `backtest-tick-input.ts` builds the agent input from candle cache; in-memory fingerprint mirror via `replay-recording.ts`.
- `app/services/swarm/`: daily-plan layer that builds a per-asset bias snapshot the trader reads as context. Not a per-trade decision swarm.
- `app/api/`: REST routes for activity, equity, strategy chat, admin LLM-call audit, reasoning bundles, public flagship workflow endpoint.
- `app/legal/disclaimer/page.tsx`: paper-mode + no-advice copy.
- `lib/db/schema/`: Drizzle schema modules (selbo_instances, monitor_ticks, trades, llm_calls, equity_snapshots, setup_records, strategy_revisions, daily_plans, backtest_runs, backtest_trades, arc_contracts, broker_fees, ...).
- `lib/arc/`: Arc anchoring integration. `anchor.ts` SHA-256 hashes the full agent context and emits via the PortfolioDecisions contract from each user's Circle wallet.
- `lib/market-features.ts` + `lib/perp-market-state.ts`: deterministic indicator + perp-tape snapshot the agent reads (volume profile, value area, regime, funding state, OI flow, recent candles).
- `lib/personas/roster.json`: 14 specialized personas. Currently used in daily-planning context; available for future best-of-N candidate sampling in the manager layer.
- `components/dashboard/`: bento dashboard widgets (balance-risk, equity-curve, trade-decision-drawer, strategy-chat, pipeline-now, cycle-workflow, swarm-cycle-trace, backtest-runner, etc).
- `components/marketing/`: landing sections (hero, live-trade-card, how-it-works, on-chain-anatomy, faq, cta-footer).
- `components/legal/`: ToS gate.

## Out of scope for hackathon

- Live venue execution.
- Multi-venue support beyond Hyperliquid market data.
- User-editable risk limits beyond tier defaults.
- Mobile responsive dashboard (1024+ desktop only; legal page mobile-readable).
- Custom user-defined dashboard layouts.
