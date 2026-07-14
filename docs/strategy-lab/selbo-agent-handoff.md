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

- Equal sample comparison matters. Do not compare 41 trades against 100+ as equivalent.
- Calendar-day and equal-trade results answer different questions.
- More filters/hardcoded thresholds are not automatically progress.
- Static strategy optimization repeatedly produced misleading confidence.
- The reader must track live-forming candles/orderflow; LTP can be simulated from trades.
- Reports must include costs before results are meaningful.
- Tests that preserve wrong behavior are worse than no tests.

## CVD Transition Analysis

Added `--transition-analysis` flag to `scripts/backtest-market-structure.ts`. Evaluates every consecutive CVD transition (prev trade -> current trade) regardless of streak context. Breaks results into three context buckets:

- **in-loss-streak**: current trade is a loss (always -1.00 R by definition)
- **in-win-streak**: current trade is a win and previous trade was also a win
- **at-boundary**: current trade is a win but previous trade was a loss (first win after a losing sequence)

### Core Finding

**The edge comes from the losing-streak context (boundary trades), not from the CVD transition type itself.**

Evidence from 278 trades over 3 weeks (May 1-22, 2025):

| Context | Avg R | Interpretation |
| --- | ---: | --- |
| in-loss-streak | -1.00 | All losses, by definition |
| in-win-streak | moderate (15-25R) | Continuation wins |
| at-boundary | highest (22-55R) | First win after loss streak |

The previous `--state-analysis` finding that "falling->rising and high->low show consistent positive expectancy after losing sequences" was detecting a real effect, but the effect is **boundary trades** - not the CVD transition type. The CVD transition just happened to correlate with when boundaries occur.

Key observations:
- Within loss-streaks, ALL CVD transitions show -1.00 R. The CVD state during a losing sequence has no predictive power for that sequence's trades.
- `bullish->none` divergence transition shows the highest boundary R (53.36R, n=6) but small sample.
- `med->high` magnitude transition shows 56.84R at boundary (n=4) - too small.
- The largest boundary samples (`none->none` divergence, n=37; `low->low` magnitude, n=23) show moderate but consistent positive R.

### Implications

1. Do not build CVD-transition-based entry filters expecting edge from the transition itself.
2. The losing-streak recovery pattern is real but the R comes from the first-win-after-loss dynamic, not CVD state.
3. Future reader work should focus on **when the system transitions out of a losing sequence** rather than what the CVD looks like during the sequence.

## distToPoc: The Only Cross-Validated Predictor

Feature discrimination analysis and response curves identified `distToPoc = |price - POC|` as the only pre-entry feature that:

1. Shows a monotonic response curve (Spearman rho > 0.8 across months)
2. Survives partial effect testing (predicts R within each profileRange decile)
3. Works for both sides, both CVD trends, and both action types

### Why It Works

distToPoc measures **auction extension** - how far price has deviated from the market's accepted fair value (the highest-volume price level).

When price is far from POC, the market is in directional discovery. The trend is either continuing (large R) or exhausting (small R). The paradox: high distToPoc trades have **lower win rate** (24% vs 45% for bottom quintile) but **much higher avg R** (17.2R vs 0.7R in May). The few big wins dominate.

### Not a Proxy

- Correlated with distToValueLow (r~0.65) and profileRange (r~0.65) but not fully explained by either
- Partial effect test: within each profileRange decile, high distToPoc trades outperform by 2-11R
- nodeVolume (r<0.1) is not a proxy

### Key Numbers (May 2025)

| distToPoc quintile | n | Win% | Avg R |
| --- | ---: | ---: | ---: |
| Bottom 20% | 56 | 45% | 0.7R |
| Top 20% | 54 | 24% | 17.2R |

### Implications

1. distToPoc captures the degree of trend extension, not mean reversion
2. It works because the R/R is asymmetric: lower hit rate but larger winners
3. It should be treated as a **position sizing or confidence input**, not a binary filter

## Why High distToPoc Trades Fail

77-79% of high distToPoc trades lose. The discriminator between winners and losers is **CVD**.

| Feature | May diff (winners higher) | Jun diff | Stable? |
| --- | ---: | ---: | --- |
| cvd | +186% | +72% | Yes |
| cvdHigh | +62% | +24% | Yes |
| priceChange | +89% | +17% | Yes |

But CVD as a filter is inconsistent across months:
- May: cvd>=25 improves avg R from 5.96 to 15.07
- Jun: cvd>=25 barely moves avg R (5.73 to 4.94)
- CVD distributions are nearly identical between months (same median, same P90)
- The inconsistency is not a regime-scaling problem - CVD genuinely has power in May and not in June

**Conclusion: CVD is a weak signal that helps in some regimes and hurts in others. Do not add as a hard filter.**

## POC Migration

Only 17 of 278 trades had >= 2 POC snapshots (trades lasting >5 minutes). Of those:
- 16/17 showed POC migrating toward entry price
- Big winners showed 98.5 points of POC migration vs 70.6 for losers
- The mechanism: winners have POC moving toward price (value acceptance), losers have price moving toward POC (reversion)

## Temporal Features

15 temporal features computed from the last 120 seconds of orderflow before entry.

### Key Finding

Temporal features rank #1 in discrimination, above all static features:

| Rank | May feature | May |d| | Jun feature | Jun |d| |
| --- | --- | ---: | --- | ---: |
| 1 | upCloseRatio (T) | 0.424 | volumeSlope (T) | 0.327 |
| 2 | profileRange (S) | 0.373 | cvdSignChanges (T) | 0.276 |
| 3 | tradeRate (T) | 0.370 | cvdImpulseCount (T) | 0.276 |

Most temporal features are independent of distToPoc (r < 0.3).

**But they are not stable across months.** Response curves flip direction. The signal is real but regime-dependent.

## Event Sequences

Built an event vocabulary: IMPULSE_START, EXHAUSTION, REVERSAL, ABSORPTION, PULLBACK, ACCEPTANCE, RATE_EXPANDS, RATE_CONTRACTS.

### Core Finding

**Sell-side events consistently distinguish winners across months:**

| Event | May (more in winners) | Jun (more in winners) | Stable? |
| --- | --- | --- | --- |
| sell_ABSORPTION | +7.0% | +6.4% | **Yes** |
| sell_IMPULSE_START | +6.2% | +8.8% | **Yes** |
| buy_ABSORPTION | +4.6% | -7.0% | Flips |
| buy_IMPULSE_START | +6.7% | -3.4% | Flips |

**The market narrates: winners happen when selling is being absorbed (market rejecting lower prices). Losers happen when buying is being absorbed (market rejecting higher prices).**

### Last event before entry

RATE_CONTRACTS as last event: avg R 9.0 (May), 6.3 (Jun) - consistently higher than ACCEPTANCE (4.4/4.9). Volatility contraction before entry predicts larger moves.

### Current Limitation

The event detector is too sensitive (~70 events per trade). Most are neutral RATE/ACCEPTANCE events. The meaningful directional events are buried. Needs threshold tightening.

## CLI Flags for `scripts/backtest-market-structure.ts`

- `--start YYYY-MM-DD` / `--end YYYY-MM-DD`: date range
- `--interval 60000`: read interval ms
- `--orderflow-window 120000`: orderflow window ms
- `--no-rejecting`: filter out rejecting hypothesis trades
- `--discovering-only`: only keep discovering hypothesis trades
- `--bullish-div`: filter to bullish divergence trades only
- `--no-trail`: disable trailing stop
- `--streak-analysis`: win/loss streak distribution
- `--state-analysis`: CVD transition analysis around losing sequences
- `--transition-analysis`: all CVD transitions with context breakdown
- `--feature-analysis`: pre-entry feature discrimination (top 20% vs rest)
- `--response-curves`: decile response curves for distToPoc, profileRange, nodeVolume, distToValueLow
- `--explain-poc`: correlation matrix, partial effects, mechanism analysis for distToPoc
- `--poc-migration`: POC snapshot tracking during trades
- `--poc-failure`: high distToPoc winner vs loser comparison
- `--cvd-filter`: CVD threshold evaluation with loser/winner removal stats
- `--cvd-distribution`: CVD distribution stats and percentile-normalized filter
- `--temporal-analysis`: 15 temporal features from pre-entry orderflow
- `--event-analysis`: event vocabulary, sequence comparison, snapshot-matched pairs

Do not read `.env.local` or production env files.

