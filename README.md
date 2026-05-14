# Selbo

Selbo is an autonomous perpetual futures risk manager. It monitors leveraged positions 24/7, protects users from liquidation, and uses AI agents to decide when to enter, exit, hedge, or migrate positions across perp venues.

Built for the Agora Agents hackathon (Canteen x Circle x Arc, 2026-05-11 to 2026-05-25) against **RFB 01: Perpetual Futures Trading Agent**. The hackathon milestone is paper-mode autonomy with transparent risk logs, simulated PnL, drawdown, trade volume, and Arc-anchored decision records. Live venue execution comes after the risk engine and venue adapters are stable.

## User Value

Selbo manages perp risk while the user is away from the screen.

- Liquidation protection: detect shrinking liquidation buffers and route urgent protection before deeper deliberation.
- Managed leverage: size and leverage decisions are checked against portfolio risk before execution.
- Adaptive exits: stop-loss and take-profit levels are persisted and enforced by the watcher heartbeat.
- Strategic review: slower multi-agent swarms review regime shifts, hedges, funding opportunities, and long-term positioning.
- Audit trail: closed-trade reasoning is anchored on Arc so decisions can be inspected later.

## Core Flow

```text
Market data
  -> Risk Engine
  -> Watcher
  -> Fast Trader for urgent actions
  -> Swarm for strategic actions
  -> Evaluators and critic
  -> Paper executor
  -> Memory + Arc anchor
```

The watcher is designed to stay cheap. It reads shared market context, user positions, recent news, and the deterministic risk snapshot. Critical risk can bypass the LLM and route directly to protection.

## Status

- Stage: hackathon build, paper-mode only.
- Venue: Hyperliquid testnet for market data; no live order placement.
- Custody: zero. Trades are simulated against Hyperliquid mark prices.
- Audit: closed trades are anchored to Arc Testnet via Circle Smart Contract Platform.

## Tech Stack

- Next.js 15, React 18, TypeScript 5.3, Tailwind 4
- Drizzle ORM + Supabase Postgres
- Better Auth + Polar billing
- Circle Developer-Controlled Wallets and Circle Smart Contract Platform
- Hyperliquid testnet market data
- Cloudflare Workers via OpenNext
- LLM tier mapping configured via env; see `.env.example`

Typechecker: `tsgo` (`@typescript/native-preview`), a Go reimplementation of `tsc`.

## Development

```bash
bun install
cp .env.example .dev.vars
bun run db:push
bun run dev
```

The app runs at `http://localhost:3000`. Production secrets are uploaded via `wrangler secret bulk .dev.vars`.

## Quality Gates

```bash
bun run typecheck
bun run check
```

CI runs typecheck on every push and pull request via `.github/workflows/typecheck.yml`.

## Project Layout

- `app/services/risk-engine.service.ts`: deterministic perp risk snapshot and emergency action classification.
- `app/services/watcher`: low-cost routing layer. Outputs `hold`, `execute`, `deliberate`, or `risk_emergency`.
- `app/services/fast-trader`: tactical short-term decision path for urgent watcher signals.
- `app/services/swarm`: strategic multi-agent decision path for slower portfolio decisions.
- `app/services/trades/paper-trade.service.ts`: paper execution, safety-trigger enforcement, memory, and Arc anchor handoff.
- `lib/db/schema/`: Drizzle schema modules.
- `lib/arc/`: Arc anchoring integration.

## M1 Schema Note

M1 includes a safe database rename migration from `solon_instances` to `selbo_instances` and `monitor_ticks.solon_instance_id` to `monitor_ticks.selbo_instance_id`. Do not use `db:push` against an existing database until that migration has been applied or generated into the target environment.

## Out of Scope For Hackathon

- Live venue execution.
- Multi-venue support beyond Hyperliquid market data.
- User-editable risk limits beyond tier defaults.
