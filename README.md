# Selbo

> **Selbo V2 (in-progress)**: a standalone RL agent. V2 does NOT touch this Next.js watcher/trader flow. V2 is greenfield: separate directory/service, scheduled by **cron-job.org** (NOT Vercel cron, NOT Inngest). "Selbo IS the model" - the RL agent itself is the product, not a wrapper around the existing V1 system.
>
> **Branch strategy**: `main` (this branch) deploys to selbo.app and is the stable submitted version. All V2 work happens on `dev`, which deploys to dev.selbo.app. Until V2 is ready to replace V1, expect main to stay roughly as-is.

Selbo (V1) is an autonomous perpetual futures trading agent. It runs 24/7 per user on Hyperliquid testnet, reads market state and risk continuously, and asks AI agents to decide when to open, close, hedge, or hold positions. Every decision is recorded, every trade is anchored on Arc, and the user can read the full reasoning behind any action Selbo takes.

Built for the Agora Agents hackathon (Canteen x Circle x Arc, 2026-05-11 to 2026-05-25) against **RFB 01: Perpetual Futures Trading Agent**. The submission target is paper-mode autonomy with transparent risk + reasoning logs, simulated PnL and drawdown, and Arc-anchored decision records.

> **Paper mode only.** No real funds at risk. No financial advice. Selbo is a hackathon experiment, not a regulated product. See the in-app ToS gate and `/legal/disclaimer`.

## What the user sees

The dashboard is one viewport (1440x900 target), 12-col bento grid:

- **Activity tape**: chronological stream of every watcher tick, trade open, and trade close.
- **Balance + risk** tile: current equity, 24h delta, risk status, closest liquidation buffer, margin usage.
- **Price chart with trade markers**: trade entries and exits overlaid on a TradingView chart. Click a marker to open the decision drawer.
- **Equity history** area chart: 1D / 7D / 30D wallet curve.
- **Strategy chat** drawer: refine the strategy in plain English; Selbo replies with a one-sentence acknowledgment. The next watcher tick uses the new strategy.
- **Memory** disclosure: every lesson Selbo learned from a closed trade. Thumbs up / thumbs down / delete. Bad-rated and deleted lessons are filtered from future agent context.
- **Decision drawer** (per trade): full reasoning trail. Watcher rationale, trader rationale, market features at decision time, risk read, deterministic safety-rail outcome, Arc anchor links.

Below the fold (collapsed disclosures): Market state, Trade history, Arc anchors, Lifetime stats, Decisions (cycle traces), Dev controls (admin).

## Architecture

```text
Hyperliquid + news
  -> Watcher (cheap LLM tick, cadence informed by realized vol)
  -> Fast Trader for tactical actions
  -> Swarm for strategic deliberation
  -> Risk Engine gate + deterministic safety rails
  -> Paper executor
  -> Memory + Arc anchor
```

The watcher stays cheap. It reads market features (RSI, EMA, ATR, regime, OI, recent candles), open positions, news context, and a deterministic risk snapshot. Critical risk bypasses the LLM and routes straight to protection. Strategy text passes through raw end-to-end; no field extraction.

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

- `app/services/risk-engine.service.ts`: deterministic perp risk snapshot and emergency action classification.
- `app/services/watcher`: low-cost routing layer. Verdicts: `hold | execute | deliberate | risk_emergency`.
- `app/services/fast-trader`: tactical short-term decision path for urgent watcher signals.
- `app/services/swarm`: strategic multi-agent decision path for slower portfolio decisions.
- `app/services/trades/paper-trade.service.ts`: paper execution, safety-trigger enforcement, memory, and Arc anchor handoff.
- `app/services/setup-fingerprint/`: structured learning primitive. Per (asset, side, value_location, volume_state, oi_flow, funding_state) records the agent's empirical EV (W/L, avg R, lossesByReason, state-shift counts). Replaces the prose lessons system the agent rationalized around.
- `app/api/`: REST routes for activity, equity, strategy chat, admin LLM-call audit, and reasoning bundles.
- `app/legal/disclaimer/page.tsx`: paper-mode + no-advice copy.
- `lib/db/schema/`: Drizzle schema modules (selbo_instances, monitor_ticks, trades, llm_calls, equity_snapshots, setup_records, strategy_revisions, ...).
- `lib/arc/`: Arc anchoring integration.
- `lib/market-features.ts`: deterministic indicator + regime snapshot (RSI, EMA, ATR, volatility, candidate bias, cadence hint).
- `components/dashboard/`: dashboard widgets.
- `components/dashboard/bento/`: bento cell components (balance-risk, equity-curve, price-with-trades drawer, memory-cards, strategy-chat, trade-decision-drawer).
- `components/legal/`: ToS gate.

## Out of scope for hackathon

- Live venue execution.
- Multi-venue support beyond Hyperliquid market data.
- User-editable risk limits beyond tier defaults.
- Mobile responsive dashboard (1024+ desktop only; legal page mobile-readable).
- Custom user-defined dashboard layouts.
