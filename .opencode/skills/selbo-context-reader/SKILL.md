---
name: selbo-context-reader
description: Use when designing or implementing Selbo's context-first live reader loop, narrative engine, market-context memory, orderflow/POC/value-area interpretation, action tracking, thesis dossiers, or shadow-mode reader integration. Focuses on why a market read exists rather than static strategy optimization.
---

# Selbo Context Reader

## Core Shape

Build a reader that understands context before it emits or manages a trade. A signal is not enough; Selbo must know why the level matters, what narrative the market is in, and what would invalidate the read.

## Reader Loop

1. Build market context:
   - trend/regime
   - support/resistance
   - volume profile, POC, value high/low
   - auction location and acceptance/rejection
   - orderflow pressure and absorption
   - volatility/violence and session behavior
2. Write/update narrative:
   - breakout-friendly
   - rejection-friendly
   - rotation/noise
   - exhaustion/liquidation
   - no-trade
3. Track setup candidates:
   - watched level
   - expected reaction
   - current proof
   - invalidation
   - reason to wait
4. React to live-forming candles/orderflow:
   - use LTP from trades in backtest simulation and live feeds.
   - update candidates as candles form, not only after close.
5. Emit dossier:
   - context before open
   - action/thesis
   - management updates
   - context after close
   - what failed or worked

## Constraints

- Keep strategy logic out of Tangent.
- Keep market-data/network/storage out of Perry-compatible strategy package.
- Avoid static strategy gates unless they are descriptive measurements from current context.
- Prefer shadow/paper mode before live execution.
- Record avoided trades if the system had a thesis and rejected it.

## Research State

For current benchmark numbers and artifacts, read:

`../selbo-reader-research/references/reader-research-state.md`
