# Selbo

Selbo is an autonomous perpetual futures risk manager. It monitors leveraged positions 24/7, protects users from liquidation, and uses AI agents to decide when to enter, exit, hedge, or migrate positions across perp venues.

The product is built for RFB 01: Perpetual Futures Trading Agent. The first milestone is paper-mode autonomy with transparent risk logs, simulated PnL, Sharpe, drawdown, trade volume, and Arc-anchored decision records. Live execution comes after the risk engine and venue adapters are stable.

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

## Services

- `app/services/risk-engine.service.ts`: deterministic perp risk snapshot, liquidation-distance checks, margin pressure, exposure, and emergency action classification.
- `app/services/watcher`: low-cost routing layer. Outputs `hold`, `execute`, `deliberate`, or `risk_emergency`.
- `app/services/fast-trader`: tactical short-term decision path for urgent watcher signals.
- `app/services/swarm`: strategic multi-agent decision path for slower portfolio decisions.
- `app/services/agents`: evaluator layer for critic and tax-aware review.
- `app/services/trades/paper-trade.service.ts`: paper execution, safety-trigger enforcement, memory, and Arc anchor handoff.

## RFB 01 Mapping

| RFB requirement | Current Selbo path |
| --- | --- |
| 24/7 monitoring | Cloudflare cron heartbeat calls the watcher every minute and each instance controls its own next watcher time. |
| Split-second leverage decisions | Fast Trader path exists; deterministic emergency protection is being moved ahead of LLM calls. |
| Liquidation protection | Risk Engine classifies liquidation distance and margin pressure; `risk_emergency` routes directly to Fast Trader. |
| Dynamic stop-loss / take-profit | Agent-set safety levels are stored and enforced during cron heartbeats. |
| Cross-platform execution | Not live yet. Add venue adapters before integrating Hyperliquid, dYdX, GMX, and Vertex execution. |
| Funding-rate opportunities | Funding is read from Hyperliquid and passed into watcher, fast trader, and swarm context. |
| Arc settlement / audit | Closed-trade reasoning is anchored on Arc. Settlement-intent and cross-venue state commitments are next. |

## Near-Term Roadmap

1. Stabilize build and CI: `typecheck`, `build`, and OpenNext deployment checks.
2. Expand the risk engine: drawdown, volatility, concentration, funding drag, stale data, and max-loss budgets.
3. Replace generic/yield personas with perp-native agents: liquidation-risk officer, funding arbitrageur, volatility regime analyst, execution/slippage analyst, cross-venue basis analyst, and adversarial critic.
4. Add a typed `VenueAdapter` interface for market state, positions, orders, collateral, and funding.
5. Keep live trading disabled until paper-mode metrics show stable behavior.

## Development

Install dependencies:

```bash
bun install
```

Run locally:

```bash
bun run dev
```

Typecheck:

```bash
bun run typecheck
```

Build:

```bash
bun run build
```

Combined check:

```bash
bun run check
```

## Required Environment

See `.env.example` for the full set of variables. The important groups are:

- Postgres/Supabase: `DATABASE_URL`, `DIRECT_URL`
- Circle/Arc: `CIRCLE_API_KEY`, `CIRCLE_ENTITY_SECRET`, `NEXT_PUBLIC_AGENT_WALLET_ID`, `NEXT_PUBLIC_ANCHOR_CONTRACT_ADDRESS`
- LLM tiers: main, review, watcher, and trader model credentials
- Better Auth: `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `NEXT_PUBLIC_BETTER_AUTH_URL`
- Cron: `CRON_SECRET` in production

## Safety Position

Selbo is currently paper-mode first. The system should prove risk management, latency, drawdown control, and decision traceability before live funds are enabled.
