# Selbo

Per-user AI perpetual futures trader. Sign up, get a Circle Developer Wallet on Arc Testnet, describe your strategy in plain English, and your Selbo runs continuously.

Built for the Agora Agents hackathon (Canteen x Circle x Arc, 2026-05-11 to 2026-05-25) as a submission against **RFB 01 (Perpetual Futures)**. Paper-mode only for the hackathon; live venue execution is post-submission.

## Status

- **Stage:** hackathon build, paper-mode only.
- **Venue:** Hyperliquid testnet for market data; no live order placement.
- **Custody:** zero. Trades are simulated against Hyperliquid mark prices.
- **Audit:** every closed trade is anchored to Arc Testnet via Circle SCP.

## Architecture

Decision loops, ordered by latency:

1. **Watcher** (cheap, frequent). Deterministic pre-filter runs first; only triggers a watcher LLM if the filter flags the user may care. Verdicts: `hold | execute | deliberate | risk_emergency`.
2. **Risk Engine** (deterministic, no LLM). Gates every trade open and runs on every tick. Limits seeded from tier defaults. Returns `allow | deny | emergency_close`.
3. **Fast Trader** (tactical, sub-second). LLM picks between allowed actions; risk engine clamps size and leverage before insert.
4. **Strategic Swarm** (16 perp-native personas plus aggregator, tax/compliance, and critic). Triggered on watcher `deliberate` for paying tiers. Handles regime, watchlist, venue, funding-rate arb, portfolio posture.
5. **Emergency Guard.** Bypasses all LLMs. Liquidation distance, stop-loss / take-profit cross, or daily-loss breach routes straight from pre-filter to Risk Engine emergency-close.

Strategy text stays raw end-to-end. No prompt-based parsing of user intent.

## Tech stack

- Next.js 15, React 18, TypeScript 5.3, Tailwind 4
- Drizzle ORM + Supabase Postgres
- Better Auth + Polar billing
- Circle Developer-Controlled Wallets (auto-provisioned per user)
- Circle Smart Contract Platform (`PortfolioDecisions` contract anchors `TradeAnchored` events on Arc Testnet)
- viem 2 + wagmi 2 + ConnectKit (external-wallet view-only)
- Hyperliquid testnet for market data
- Cloudflare Workers via OpenNext
- TradingView Lightweight Charts
- LLM tier mapping configured via env; see `.env.example`

Typechecker: `tsgo` (`@typescript/native-preview`), a Go reimplementation of `tsc`.

## Getting started

```bash
git clone <repo>
cd agoratest
bun install
cp .env.example .dev.vars
# edit .dev.vars with your Supabase, Circle, Polar, and LLM keys
bun run db:push
bun run dev
```

The app runs at `http://localhost:3000`. `drizzle-kit` will prompt to confirm any schema migrations during `db:push`.

For Cloudflare preview and deploy:

```bash
bun run preview   # local Workers preview
bun run deploy    # ship to Cloudflare
```

Production secrets are uploaded via `wrangler secret bulk .dev.vars`, not per-key `wrangler secret put` calls.

## Quality gates

```bash
bun run typecheck   # tsgo --noEmit
bun run check       # typecheck plus next build
```

CI runs typecheck on every push and pull request via `.github/workflows/typecheck.yml`.

## Project layout

- `app/` Next.js app router (pages, API routes, server actions)
- `app/services/` agent services (watcher, fast-trader, swarm, orchestrator, risk)
- `lib/db/schema/` Drizzle schema modules
- `lib/data-sources/` external market data clients (Hyperliquid, CoinGecko, news, DefiLlama)
- `lib/personas/` swarm persona roster
- `lib/arc/` Arc anchoring (Circle SCP integration)
- `components/` React UI

## Out of scope (hackathon)

- Live venue execution. Paper-mode only.
- Multi-venue support. Hyperliquid only for now; dYdX, GMX, Vertex are post-submission.
- User-editable risk limits. Tier defaults only pre-submission.

## Submission

Submission date: 2026-05-25. Selbo is framed against **RFB 01 (Perpetual Futures)**.
