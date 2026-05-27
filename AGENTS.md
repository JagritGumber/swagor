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
  - `signals`
  - `strategies`
- Backtest hot paths should be cursor-based. Prefer `ctx.candles` plus
  `ctx.index` and `*At` indicators over slicing arrays per tick.
- Prefer explicit strategy definitions and deterministic backtests before adding UI, workers, or deployment.
- Every backtest must model costs before results are treated as meaningful.
- `packages/market-data` owns ingestion and storage adapters. Keep network,
  VictoriaMetrics, filesystem, and DB APIs out of the Perry-compatible strategy
  package.
- For multi-month local backfills, start VictoriaMetrics with an explicit
  retention flag such as `-retentionPeriod=12`, otherwise the default is about
  one month.

## Validation

- Use `bun run strategy:smoke` for the current strategy-lab smoke check.
- Use `bun run strategy:vm:smoke` to run starter strategies against candles
  stored in local VictoriaMetrics.
- Use `bun run market:smoke` for market-data adapter smoke checks.
- Use `bun run market:vm:smoke` when local VictoriaMetrics is running at
  `http://localhost:8428`.
- Use `bun run strategy:perry:compile` to verify the strategy lab still
  compiles through Perry. The generated binary is ignored.
- Use `tsgo`, not `tsc`, for typechecking.
- Do not read `.env.local` or production env files.
