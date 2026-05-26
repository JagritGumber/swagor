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
- Prefer explicit strategy definitions and deterministic backtests before adding UI, workers, or deployment.
- Every backtest must model costs before results are treated as meaningful.

## Validation

- Use `bun run strategy:smoke` for the current strategy-lab smoke check.
- Use `tsgo`, not `tsc`, for typechecking.
- Do not read `.env.local` or production env files.
