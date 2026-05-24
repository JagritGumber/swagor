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

**Selbo is the agent. Not a wrapper around the agent. Not the agent with discipline guardrails bolted on. The agent decides every trade, in full, by itself.**

The single LLM call per tick writes the entire decision: direction, asset, size, leverage, stop, take-profit, plain-English reasoning, confidence, next-check cadence. There are no hardcoded discipline gates. There is no rule engine vetting the agent's output. There is no second LLM auditing the first. We had all of these in earlier versions and stripped them. When the agent was wrapped in rules, the agent became performative theatre on top of the rules. When the rules came off and the agent had to own its own risk, the trading behavior became coherent.

The agent reads structured perp-tape inputs (volume profile, value area, regime, OI flow, funding state, recent candles) plus its own historical performance ledger on the exact configuration it is considering, gated until that ledger has enough samples to mean something. Strategy text passes through raw end-to-end; the agent is not given pre-extracted classifications, it reads the user's strategy in their own words. Critical risk (margin / liquidation) bypasses the LLM and routes to deterministic safety rails. The agent has full freedom on entries and sizing, it just cannot ignore liquidation. Same separation pattern as nof1 Alpha Arena.

Behavioral evidence from the 8-week backtest (2026-03-01 to 2026-04-30, BTC + ETH + SOL): the agent took 19 trades over 60 days, 99% of ticks correctly identified as "do nothing" and held. On the BTC|short configuration which crossed the learning ledger's 3-trade gate, win rate improved from 33% pre-gate to 44% post-gate over 12 trades. Avg loss size dropped from -$2.15 to -$0.52. The agent's behavior measurably shifted in response to its own empirical evidence.

Code: `app/services/watcher/selbo-agent-decision.ts`, `app/services/watcher/agent-prompt.ts`, `app/services/setup-fingerprint/`.

### Traction

Submitted via the Agora Google Form. The public flagship dashboard at [selbo.app/track-record](https://selbo.app/track-record) surfaces live decisions, anchored trades, and lifetime performance updated in real time as the agent runs.

### Circle Tool Usage

**Three creative uses of Circle's developer platform, each load-bearing for the autonomous agent flow rather than tacked-on for credit.**

- **Developer-Controlled Wallets per user, via the entity-secret pattern.** Each Selbo user is auto-provisioned a Circle Dev Wallet on signup. The agent signs every trade anchor from the user's own wallet, not a service account, with no per-transaction human approval required. This is non-trivial for autonomous AI flows. Standard wagmi-style approval-per-tx would break the loop entirely because the user is not in the loop.
- **Smart Contract Platform for the anchor contract.** The PortfolioDecisions contract on Arc Testnet was deployed via Circle's Smart Contract Platform and is source-verified on Arcscan at `0xa92913539d7fbed157974a08293b2620ac0d0277`. Anyone can read every line of the Solidity that produces the on-chain record of an agent decision.
- **USDC on Arc as the brokerage-fee settlement asset.** A min($0.10, sizeUsd * 2%) USDC fee per closed trade routes from the user's Circle wallet to the Selbo treasury wallet (also Circle-backed), idempotent via a unique index on `broker_fees.trade_id`. Real economic plumbing, not just a demo of moving stablecoins.

Code: `app/services/selbo-instance.service.ts`, `lib/arc/anchor.ts`, `contracts/yield_routing/PortfolioDecisions.sol`, `app/services/brokerage/charge-fee.service.ts`.

### Innovation

**Three contributions we think advance how AI agents can be deployed and trusted on-chain. Each shipped, each verifiable.**

**1. Quantitative learning where prose lessons fail.**
We built a "lessons" system the way most agent products do. Extract one-sentence takeaways after each closed trade. Feed them back as context. The agent rationalized around every single one. "Do not repeat this setup" was read, and immediately ignored, because each new tick LOOKED different. The narrative the agent generated about its own past was a permission slip, not a constraint. We ripped it out and replaced it with a structured ledger keyed on the exact perp-tape configuration the trade was taken in. The agent now reads numbers, not stories. Empirical W/L and avg R-multiple on the specific configuration it is about to take, gated until enough trades have accumulated to be meaningful. We think this is the right primitive for in-context agent learning: anything that lets the agent generate its own narrative about its past is something it can talk itself out of. Backtest confirmed the behavioral shift (33 to 44 percent win rate on BTC|short after the ledger crossed its gate).

**2. Reasoning bound to the on-chain record.**
Every Selbo decision SHA-256 hashes its full agent context (market state, positions, risk read, rationale) and anchors that hash on Arc. The full reasoning lives off-chain in Postgres; the hash binds it forever. The agent literally cannot revise what it said after the outcome is known. We think this is the verifiability primitive AI agents need to be trusted. Not "trust the agent's behavior," but "you can prove the rationale was not edited after the result was in." Combined with Circle Dev Wallet signing, the on-chain record is bound to the user's wallet AND to the immutable hash AND to the source-verified contract.

**3. A backtest that is actually the live agent.**
We deliberately rejected the cheaper-backtest pattern (deterministic engine wearing an agent costume, identical numbers across runs, none of them representative). Our public 8-week backtest runs the IDENTICAL `decideSelboTick` function as live, calling the same LLM with the same prompt and same payload shape. Cost roughly $0.15 per 60-day run via Mistral-Small. We accept the cost as the price of fidelity. What you see in our public track record is what you would see if you deployed Selbo today. A parity test of 66 assertions enforces that the in-memory backtest fingerprint mirror produces byte-identical state to the live SQL upsert path, so the same agent reads the same shape of evidence in both worlds.

Code: `app/services/setup-fingerprint/`, `lib/arc/anchor.ts`, `app/services/backtest/watcher-tick-step.ts`, `scripts/test-logic.ts`.

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
