---
name: selbo-integration-handoff
description: Use when converting reader research into Selbo integration work, planning shadow-mode/paper-mode strategy management, connecting live-reader with strategy-lab and market-data, or onboarding a new agent to the current Selbo/Tangent project split and deployment priorities.
---

# Selbo Integration Handoff

## Project Split

- `packages/strategy-lab`: reader/strategy research, deterministic evaluation, Perry-compatible where practical.
- `packages/market-data`: ingestion, Bybit/orderflow data, VictoriaMetrics, parquet/local storage adapters.
- `packages/live-reader`: orchestration that combines feeds/storage with strategy-lab reads.
- Tangent: venue/infrastructure track only; do not put strategy logic there.
- Old watcher/trader app: hackathon artifact, not the strategy foundation.

## Integration Target

Integrate the current benchmark reader into Selbo as a managed, observable, paper/shadow strategy first. Selbo should not just place trades; it should manage strategy state, record context, explain outcomes, and decide when a reader should be trusted or paused.

## Required Runtime Records

Every reader decision should persist:

- market context snapshot
- narrative state
- setup candidate/action tracker state
- entry/avoid reason
- management updates
- final result and outcome explanation
- links to candle/orderflow/POC dossier artifacts

## Next Work Order

1. Confirm benchmark branch/artifacts from `selbo-reader-research`.
2. Build shadow-mode runner for `vp-trend-down-active-price-follow-025`.
3. Persist dossiers for every emitted/avoided action.
4. Run unseen-month replay and compare to current benchmark.
5. Only then discuss sizing/live execution.

## Validation

- Use `bun.cmd run typecheck`.
- Prefer integration surfaces through package imports, not CLI-only flows.
- CLI scripts may generate reports but should stay thin.
- Do not read `.env.local` or production env files.
