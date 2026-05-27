# Agent Notes

## Project Direction

- Work on `dev` for post-hackathon strategy-lab work.
- The old watcher/trader flow is a submitted artifact, not the foundation for new strategy research.
- Keep internal packages brand-neutral. Do not prefix package names, database tables, or strategy code with the product name unless the surface is explicitly UI or marketing.
- Tangent remains a separate venue/infrastructure track. Do not put strategy logic in Tangent.

## Strategy Lab

- `packages/strategy-lab` is the first research surface.
- Keep TypeScript in this package dependency-light and Perry-compatible where practical.
- Use meaningful folders plus grep-first filenames. File names should match the exported function, strategy, or concept.
- Current folders:
  - `backtest`
  - `indicators`
  - `orderflow`
  - `read`
  - `reader-live`
  - `signals`
  - `strategies`
- Backtest hot paths should be cursor-based. Prefer `ctx.candles` plus
  `ctx.index` and `*At` indicators over slicing arrays per tick.
- Prefer explicit strategy definitions and deterministic backtests before adding UI, workers, or deployment.
- Every backtest must model costs before results are treated as meaningful.
- `packages/market-data` owns ingestion and storage adapters. Keep network,
  VictoriaMetrics, filesystem, and DB APIs out of the Perry-compatible strategy
  package.
- `packages/market-data` uses human-sortable folders with grep-first file
  names:
  - `shared`
  - `hyperliquid`
  - `orderflow`
  - `victoria-metrics`
  - `ingest`
- Raw orderflow feed files are written under `orderflow-data/` as local NDJSON
  and are ignored by git. Keep raw trades/BBO out of VictoriaMetrics; use
  VictoriaMetrics for candle data and later summaries.
- For multi-month local backfills, start VictoriaMetrics with an explicit
  retention flag such as `-retentionPeriod=12`, otherwise the default is about
  one month.

## Validation

- Use `bun run reader:live --asset BTC --seconds 60` as the main system check.
  It combines VictoriaMetrics auction context with live Hyperliquid trades+BBO
  and persists raw orderflow NDJSON.
- Use `tsgo`, not `tsc`, for typechecking.
- Do not read `.env.local` or production env files.
