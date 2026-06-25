# Selbo Strategy Lab Agent Handoff

## Purpose

This document compresses the strategy-lab work so a fresh agent can continue without rereading the long conversation. Prefer the repo-local skills in `.codex/skills` for task-specific behavior:

- `selbo-reader-research`: evaluate reader hypotheses and protect result integrity.
- `selbo-context-reader`: design/implement context-first reader architecture.
- `selbo-integration-handoff`: integrate benchmark readers into Selbo shadow mode.

## Product Direction

Selbo should be a context-first market reader and strategy manager. The earlier hackathon watcher/trader flow was built quickly to satisfy Arc/Circle requirements and is not the foundation for strategy research.

The direction now is closer to an `entire.io`-style context system:

- Know why a market read exists.
- Track the context around POC, value area, support/resistance, volatility, and orderflow.
- Decide whether the current market favors breakout, rejection, rotation, or no trade.
- Record why a trade or avoided trade worked or failed.
- Let Selbo manage, pause, size, and review strategies based on evidence.

## Project Split

- `packages/strategy-lab`: Perry-compatible reader/strategy research where practical.
- `packages/market-data`: ingestion, local storage, VictoriaMetrics, Bybit/orderflow data.
- `packages/live-reader`: whole-flow reader orchestration that combines market data and strategy-lab reads.
- Tangent: separate venue/infrastructure track. Do not put strategy logic in Tangent.
- Old watcher/trader app: submitted artifact only.

## Current Worktrees

- Root: `D:\Projects\agoratest`, observed on `reader-trend-following-experiment` with existing dirty/untracked strategy files.
- Latest benchmark: `D:\Projects\agoratest\.worktrees\reader-high-r-restart`, branch `reader-high-r-restart`, pushed at `957c25e`.

Always run:

```powershell
git worktree list
git status --short --branch
```

before editing or reporting.

## What Was Built

The strategy-lab research stack now includes:

- candidate-tape generation/replay
- reader hypothesis evaluation
- score reports
- inspection reports with worst/best trades and losing streaks
- stability reports
- Monte Carlo reports
- equal-trade absorption comparison reports
- Bybit orderflow backfill/import tooling
- compact local orderflow workflow

Important latest files in `.worktrees/reader-high-r-restart`:

- `packages/strategy-lab/reader-hypotheses/default-reader-hypotheses.ts`
- `packages/strategy-lab/reader-hypotheses/evaluate-reader-hypotheses.ts`
- `packages/strategy-lab/reader-hypotheses/build-reader-hypothesis-score-report.ts`
- `packages/strategy-lab/reader-hypotheses/build-reader-hypothesis-inspection-report.ts`
- `packages/strategy-lab/reader-hypotheses/build-reader-hypothesis-monte-carlo-report.ts`
- `scripts/report-reader-hypothesis-score.ts`
- `scripts/report-reader-hypothesis-inspection.ts`
- `scripts/report-reader-hypothesis-monte-carlo.ts`
- `scripts/report-reader-absorption-equal-trades.ts`

## Current Benchmark

Current benchmark reader:

`vp-trend-down-active-price-follow-025`

Score report over 184 evaluated days, 102,183 candidates, 1bp round-trip cost:

| Metric | Value |
| --- | ---: |
| Entries | 140 |
| Entry days | 43 |
| Opportunity days | 47 |
| Total R | `+229.5121R` |
| R/day | `+1.2473R` |
| R/trade | `+1.6394R` |
| Win rate | `40.71%` |
| Win lower bound | `32.93%` |
| Max DD | `-11.17R` |
| Bootstrap total P05 | `+99.1172R` |
| Bootstrap DD P05 | `-20.384R` |

At the required 100-trade comparison standard:

| Variant | 100-trade R | Max DD | Win | PF | Loss Streak |
| --- | ---: | ---: | ---: | ---: | ---: |
| `vp-trend-down-active-price-follow-025` | `+158.7397R` | `-11.17R` | `40%` | `3.0343` | `7` |
| `abs-sell-absorption-range-active` | `+96.9593R` | `-12.0602R` | `48%` | `2.4142` | `9` |
| `abs-confirmed-absorption-all-regime-all-tape` | `+95.4621R` | `-23.2458R` | `45%` | `2.3179` | `8` |
| `vp-active-long-first-reaction-nonnegative` | `+94.3054R` | `-18.6813R` | `32%` | `2.0524` | `14` |

Read: the benchmark is lower win-rate than absorption expansions, but has better R and cleaner drawdown at the 100-trade standard.

## Key Artifacts

In `.worktrees/reader-high-r-restart/artifacts`:

- `restart-score-cost-1bps.md`
- `restart-top3-monte-carlo-cost-1bps.md`
- `restart-top3-inspection-cost-1bps.md`
- `restart-absorption-equal-trades-cost-1bps.md`

Do not treat old scratch reports as canonical unless they are explicitly selected.

## Monte Carlo Summary

Top-three Monte Carlo used 10,000 samples, 1bp cost, ruin line `-25R`.

| Hypothesis | Entries | Real Total | Real DD | Day P05 Total | Day P05 DD | Day Ruin |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `vp-confirmed-absorption-trend-down-price-follow-025` | 41 | `+140.906R` | `-4.1499R` | `+63.9635R` | `-8R` | `0%` |
| `vp-trend-down-active-price-follow-025` | 140 | `+229.5121R` | `-11.17R` | `+103.9058R` | `-20.4081R` | `1.57%` |
| `vp-active-long-first-reaction-nonnegative` | 249 | `+334.8423R` | `-18.6813R` | `+208.9699R` | `-27.1054R` | `7.9%` |

The 41-trade confirmed absorption variant is interesting but too small to replace the benchmark.

## Lessons

- Equal sample comparison matters. Do not compare 41 trades against 100+ as if equivalent.
- Calendar-day and equal-trade results answer different questions.
- More filters/hardcoded thresholds are not automatically progress.
- Static strategy optimization repeatedly produced misleading confidence.
- The reader must track live-forming candles/orderflow; LTP can be simulated from trades.
- Reports must include costs before results are meaningful.
- Tests that preserve wrong behavior are worse than no tests.

## Next Plan

1. Stop broad random hypothesis hunting unless the benchmark is falsified.
2. Run the benchmark on unseen months only.
3. Run 100-trade Monte Carlo for benchmark and closest challengers.
4. Produce dossiers for worst drawdown streaks.
5. Integrate benchmark into Selbo as shadow/paper mode, not live execution.
6. Persist every thesis, context, action, avoided action, management update, and outcome.
7. Use that context memory to evolve the reader toward a true narrative engine.

## Commands

Typecheck:

```powershell
bun.cmd run typecheck
```

Do not use `tsc`; use `tsgo` through the package script.

Do not read `.env.local` or production env files.

