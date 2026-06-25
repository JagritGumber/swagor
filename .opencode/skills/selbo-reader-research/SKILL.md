---
name: selbo-reader-research
description: Use when continuing Selbo strategy-lab reader research, comparing reader hypotheses, running candidate-tape reports, Monte Carlo, equal-trade evaluations, or deciding whether a reader result is real enough to become a benchmark. Emphasizes result integrity, context-first market reading, and avoiding hardcoded curve fitting.
---

# Selbo Reader Research

## Core Rule

Treat strategy work as evidence gathering, not test-count growth. Do not declare progress unless a report shows what the reader produced, on what sample, with costs, drawdown, win rate, and comparable trade counts.

## Load First

Read `references/reader-research-state.md` before making research decisions. It contains the current benchmark, artifact paths, known mistakes, and next gates.

## Workflow

1. Confirm the active branch/worktree. The latest benchmark work was on `reader-high-r-restart`; do not assume root is current.
2. Use existing candidate tapes and reports before inventing a new hypothesis.
3. Compare results on matching standards:
   - Include round-trip costs.
   - Use at least 100 trades for serious comparison unless the task is explicitly about small-sample exploration.
   - Separate full-path results from equal-trade prefix results.
   - Use Monte Carlo for sequence risk and ruin probability.
4. Inspect worst streaks and best trades before proposing new reader changes.
5. Treat numeric thresholds in evaluator/report scripts as analysis config. Do not turn them into reader trading rules without explicit user approval.

## Current Benchmark

`vp-trend-down-active-price-follow-025` is the current benchmark reader candidate. It is not final-live-ready, but broad random hypothesis hunting should pause unless a report falsifies it.

## Validation

Use:

```powershell
bun.cmd run typecheck
```

Focused report/test commands are acceptable, but core reader behavior should be package code first. Do not add module smoke commands.
