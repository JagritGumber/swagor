# Agent Notes

## Project Direction

- Work on `dev` for post-hackathon strategy-lab work.
- The old watcher/trader flow is a submitted artifact, not the foundation for new strategy research.
- Keep internal packages brand-neutral. Do not prefix package names, database tables, or strategy code with the product name unless the surface is explicitly UI or marketing.
- Tangent remains a separate venue/infrastructure track. Do not put strategy logic in Tangent.
- For current strategy-lab context, read `docs/strategy-lab/selbo-agent-handoff.md`.
- Repo-local opencode skills live under `.opencode/skills`:
  - `selbo-reader-research` for reader hypothesis evaluation and result integrity.
  - `selbo-context-reader` for context-first live reader/narrative architecture.
  - `selbo-integration-handoff` for moving benchmark readers into Selbo shadow mode.

## Strategy Lab

- `packages/strategy-lab` is the first research surface.
- Keep TypeScript in this package dependency-light and Perry-compatible where practical.
- Use meaningful folders plus grep-first filenames. File names should match the exported function, strategy, or concept.
- Current folders:
  - `backtest` (indicators, signals, strategies, trade-plan, and backtest)
  - `read-core` (read, orderflow, market-regime)
  - `reader` (all 23 reader-* packages)
- Backtest hot paths should be cursor-based. Prefer `ctx.candles` plus
  `ctx.index` and `*At` indicators over slicing arrays per tick.
- Prefer explicit strategy definitions and deterministic backtests before adding UI, workers, or deployment.
- Every backtest must model costs before results are treated as meaningful.
- `packages/market-data` owns ingestion and storage adapters. Keep network,
  VictoriaMetrics, filesystem, and DB APIs out of the Perry-compatible strategy
  package.
- `packages/live-reader` owns whole-flow live reader orchestration that combines
  market-data feeds/storage with strategy-lab reads. Keep CLI scripts thin.
- `packages/market-data` uses human-sortable folders with grep-first file
  names:
  - `shared`
  - `hyperliquid`
  - `orderflow`
  - `victoria-metrics`
  - `ingest`
- Raw orderflow feed files are written under `.data/orderflow/` as local NDJSON
  and are ignored by git. Keep raw trades/BBO out of VictoriaMetrics; use
  VictoriaMetrics for candle data and later summaries.
- For multi-month local backfills, start VictoriaMetrics with an explicit
  retention flag such as `-retentionPeriod=12`, otherwise the default is about
  one month.

## Validation

- Core reader behavior should be exercised through code imports, not CLI
  wrappers. Use `packages/live-reader` as the integration surface for the
  whole-flow live reader.
- Do not add module smoke commands for strategy-lab, market-data, orderflow, or
  live-reader. The system should work as package code first.
- Use `tsgo`, not `tsc`, for typechecking.
- Do not read `.env.local` or production env files.
