# Selbo Market Structure Reader - Handoff

## Date
2025-07-14 (updated)

## Branch
`dev`

## What Was Built

### New Files (this session)

| File | Purpose |
|------|---------|
| `packages/strategy-lab/read-core/read/parse-volume-profile-structure.ts` | Parses 5m parquet volume profiles into HVN/LVN/POC/VAH/VAL structure |
| `packages/strategy-lab/read-core/orderflow/calculate-cvd.ts` | Calculates cumulative volume delta from 1s orderflow buckets |
| `packages/strategy-lab/reader/reader-structure/types.ts` | Types for market structure reader |
| `packages/strategy-lab/reader/reader-structure/read-market-structure.ts` | Combines structure + orderflow into single "what is happening NOW" read |
| `packages/strategy-lab/reader/reader-structure/index.ts` | Barrel export |
| `scripts/backtest-market-structure.ts` | Backtest with filters, trailing stop, streak analysis, CVD transition analysis |
| `scripts/test-market-structure.ts` | Smoke test for the reader |
| `docs/selbo-next-phase-prompt.md` | Context doc for fresh start |

### Modified Files

| File | Change |
|------|--------|
| `packages/strategy-lab/index.ts` | Added exports for new modules |

## Backtest Results (With Trailing Stop, No Extra Filters)

| Period | Trades | Win Rate | Avg R | Total R | Max DD | Long Avg R | Short Avg R |
|--------|--------|----------|-------|---------|--------|------------|-------------|
| May 2025 | 448 | 28.9% | 5.39 | 2413 | 20.1R | 5.25 | 5.53 |
| Jun 2025 | 437 | 30.4% | 5.39 | 2354 | 11.2R | 6.08 | 4.66 |
| Jul 2025 | 531 | 32.2% | 5.04 | 2677 | 17.0R | 5.37 | 4.72 |
| Aug 2025 | 450 | 28.6% | 5.05 | 2273 | 15.0R | 3.88 | 6.45 |
| Sep 2025 | 432 | 33.6% | 5.43 | 2348 | 10.0R | 5.42 | 5.45 |
| Oct 2025 | 485 | 29.3% | 8.18 | 3967 | 9.0R | 7.22 | 9.13 |
| Nov 2025 | 500 | 27.0% | 5.36 | 2682 | 32.1R | 5.72 | 4.90 |
| Dec 2025 | 408 | 30.5% | 4.59 | 1871 | 23.0R | 4.39 | 4.83 |
| Jan 2026 | 403 | 30.2% | 6.83 | 2754 | 12.0R | 6.95 | 6.72 |
| Feb 2026 | 411 | 35.8% | 7.11 | 2923 | 19.5R | 8.64 | 5.65 |
| Mar 2026 | 361 | 30.1% | 6.82 | 2461 | 13.3R | 7.50 | 6.12 |
| **Median** | **437** | **30.2%** | **5.39** | | **15.0R** | **5.72** | **5.65** |

**Target >0.2 R/trade: MET across all 11 months.** Strategy is viable with trailing stop.

## Filter Validation (Each Tested Independently)

### `--no-rejecting` (remove action:rejecting entries)

| Month | Trades | Avg R | Delta vs Base | Max DD |
|-------|--------|-------|---------------|--------|
| May 2025 | 281 | 6.47 | +1.08 | 14.4R |
| Jun 2025 | 267 | 5.53 | +0.14 | 17.5R |
| Jul 2025 | 334 | 5.86 | +0.82 | 15.0R |
| Aug 2025 | 315 | 4.92 | -0.13 | 11.0R |
| Sep 2025 | 287 | 5.95 | +0.52 | 13.7R |
| Oct 2025 | 382 | 8.48 | +0.30 | 16.3R |
| Nov 2025 | 419 | 5.52 | +0.16 | 24.9R |
| Dec 2025 | 319 | 5.12 | +0.53 | 15.0R |
| Jan 2026 | 302 | 7.46 | +0.63 | 10.0R |
| Feb 2026 | 354 | 7.91 | +0.80 | 20.5R |
| **Median** | **317** | **5.86** | **+0.57** | **15.0R** |

**Verdict:** Improves avg R by +0.57 median. Trades drop ~28%. DD similar.

### `--discovering-only` (only action:discovering entries)

| Month | Trades | Avg R | Delta vs Base | Max DD |
|-------|--------|-------|---------------|--------|
| May 2025 | 279 | 6.21 | +0.82 | 14.4R |
| Jun 2025 | 262 | 5.59 | +0.20 | 17.5R |
| Jul 2025 | 324 | 6.02 | +0.98 | 15.0R |
| Aug 2025 | 308 | 4.87 | -0.18 | 11.0R |
| Sep 2025 | 282 | 5.98 | +0.55 | 12.7R |
| Oct 2025 | 380 | 8.51 | +0.33 | 16.3R |
| Nov 2025 | 416 | 5.57 | +0.21 | 24.9R |
| Dec 2025 | 315 | 5.16 | +0.57 | 15.0R |
| Jan 2026 | 294 | 7.53 | +0.70 | 12.0R |
| Feb 2026 | 351 | 7.99 | +0.88 | 20.5R |
| **Median** | **312** | **5.98** | **+0.59** | **15.0R** |

**Verdict:** Nearly identical to no-rejecting. Equivalent candidate.

### `--bullish-div` (require bullish CVD divergence)

| Month | Trades | Avg R | Delta vs Base | Max DD |
|-------|--------|-------|---------------|--------|
| May 2025 | 36 | 7.31 | +1.92 | 6.0R |
| Jun 2025 | 49 | 3.87 | -1.52 | 9.0R |
| Jul 2025 | 40 | 8.94 | +3.90 | 5.0R |
| Aug 2025 | 42 | 2.82 | -2.23 | 12.0R |
| Sep 2025 | 44 | 7.65 | +2.22 | 4.0R |
| Oct 2025 | 49 | 4.28 | -3.90 | 24.0R |
| Nov 2025 | 45 | 2.88 | -2.48 | 13.8R |
| Dec 2025 | 47 | 3.14 | -1.45 | 8.0R |
| Jan 2026 | 25 | 9.75 | +2.92 | 4.0R |
| Feb 2026 | 28 | 14.76 | +7.65 | 9.0R |
| **Median** | **43** | **5.43** | **+0.20** | **8.5R** |

**Verdict:** Highly variable (-2.5 to +7.7). Sample too small (25-49). **Reject.**

### `--no-trail` (trailing stop removed)

| Month | Trades | Avg R | Delta vs Base | Max DD |
|-------|--------|-------|---------------|--------|
| May 2025 | 447 | 1.41 | -3.98 | 25.0R |
| Jun 2025 | 436 | 1.40 | -3.99 | 11.2R |
| Jul 2025 | 528 | 1.44 | -3.60 | 15.0R |
| Aug 2025 | 448 | 1.34 | -3.71 | 11.7R |
| Sep 2025 | 428 | 1.48 | -3.95 | 10.7R |
| Oct 2025 | 485 | 2.07 | -6.11 | 9.6R |
| Nov 2025 | 500 | 1.70 | -3.66 | 26.9R |
| Dec 2025 | 408 | 1.22 | -3.37 | 23.0R |
| Jan 2026 | 403 | 1.83 | -5.00 | 13.3R |
| Feb 2026 | 410 | 1.79 | -5.32 | 19.5R |
| **Median** | **437** | **1.46** | **-3.95** | **13.3R** |

**Verdict:** Trailing stop is critical. Removing it drops avg R from ~5.4 to ~1.5. **Keep trailing stop.**

### Filter Summary

| Filter | Median Avg R | Delta | Median Trades | Verdict |
|--------|-------------|-------|---------------|---------|
| Baseline | 5.39 | - | 437 | - |
| no-rejecting | 5.86 | +0.57 | 317 | **Improve expectancy** |
| discovering-only | 5.98 | +0.59 | 312 | **Improve expectancy** |
| bullish-div | 5.43 | +0.20 | 43 | **Reject** - too few trades |
| no-trail | 1.46 | -3.95 | 437 | **Reject** - destroys edge |

## Streak Analysis

Streaks tracked per hypothesis (discovering, rejecting, accepting). Streak resets when hypothesis changes.

### Streak Distribution

| Month | Hypothesis | Win Streak Mean | Win Streak Max | Loss Streak Mean | Loss Streak Max |
|-------|------------|-----------------|----------------|------------------|-----------------|
| May 2025 | discovering | 1.46 | 4 | 3.35 | 13 |
| May 2025 | rejecting | 1.34 | 5 | 3.94 | 17 |
| Jun 2025 | discovering | 1.43 | 4 | 3.73 | 11 |
| Oct 2025 | discovering | 1.36 | 3 | 3.40 | 11 |
| Jan 2026 | discovering | 1.48 | 4 | 3.52 | 12 |

**Finding:** Loss streaks are consistently longer than win streaks (mean ~3.5 vs ~1.4).

### Next Trade After Loss Streak (Discovering)

| Streak Len | May Avg R | Jun Avg R | Oct Avg R | Jan Avg R |
|------------|-----------|-----------|-----------|-----------|
| 1 | +2.76 | +4.65 | +9.60 | +3.94 |
| 2 | +3.20 | -0.62 | +5.76 | +5.36 |
| 3 | +5.86 | +1.03 | +12.74 | +16.99 |
| 4 | +7.09 | -0.19 | -0.74 | +20.64 |
| 5 | -1.00 | +1.53 | +10.38 | +8.21 |

**Finding:** After 3-4 losses, expectancy tends to improve (3 of 4 months). After 5+ losses, inconsistent.

### Streak Analysis Conclusion

Streak analysis did not produce evidence strong enough to justify a trading rule. Observed effects treated as exploratory only.

## State Evolution Analysis

Investigated whether improving expectancy after consecutive losses is caused by the streak itself or by underlying market transitions.

### Feature Change Rates (First -> Last Loss in Sequence)

| Feature | May 2025 | Oct 2025 | Jan 2026 | Avg |
|---------|----------|----------|----------|-----|
| priceChange | 46.7% | 63.2% | 55.3% | **55.1%** |
| cvdTrend | 51.1% | 57.5% | 50.6% | **53.1%** |
| cvdMagnitude | 53.3% | 57.5% | 43.5% | **51.4%** |
| cvdDivergence | 27.8% | 33.0% | 20.0% | **26.9%** |
| **action** | **0.0%** | **0.0%** | **0.0%** | **0.0%** |
| **location** | **0.0%** | **0.0%** | **0.0%** | **0.0%** |
| **absorption** | **0.0%** | **0.0%** | **0.0%** | **0.0%** |
| **nodeType** | **0.0%** | **0.0%** | **0.0%** | **0.0%** |

**Finding:** Structural features (action, location, absorption, nodeType) never change during losing sequences. CVD features (priceChange, cvdTrend, cvdMagnitude) change ~50% of the time.

### CVD Transition Analysis (Next Trade Expectancy)

#### cvdTrend Transitions

| Transition | May Avg R | Oct Avg R | Jan Avg R | Consistent? |
|------------|-----------|-----------|-----------|-------------|
| falling->rising | +7.66 | +7.65 | +11.19 | **Yes (7-11)** |
| rising->rising | +5.43 | +4.33 | +8.93 | Yes (4-9) |
| falling->falling | +4.83 | +0.74 | +6.32 | Weak (1-6) |
| rising->falling | +3.24 | +13.09 | +4.47 | No (3-13) |

**Best:** `falling->rising` is consistently positive (7-11 avg R, 17-36 samples).

#### cvdMagnitude Transitions

| Transition | May Avg R | Oct Avg R | Jan Avg R | Consistent? |
|------------|-----------|-----------|-----------|-------------|
| high->low | +11.04 | +27.36 | +4.30 | **Strong when sampled (11-27)** |
| med->med | +6.81 | +7.05 | +8.06 | **Yes (6-8)** |
| low->med | +2.47 | +8.66 | +16.14 | Improving |
| med->low | +2.82 | +7.10 | +1.80 | Weak (2-7) |
| low->low | +3.34 | +2.76 | +7.17 | Yes (2-7) |

**Best:** `high->low` is strong when sampled (11-27 avg R), but small samples (4-6).

#### Price Direction Transitions

| Transition | May Avg R | Oct Avg R | Jan Avg R | Consistent? |
|------------|-----------|-----------|-----------|-------------|
| flat->flat | +4.41 | +10.87 | +7.05 | **Yes (4-11)** |
| down->flat | +6.84 | +10.23 | +6.00 | **Yes (6-10)** |
| up->flat | +11.19 | +9.06 | +3.56 | Yes but declining |
| up->up | -1.00 | -0.18 | - | **Negative** |

**Best:** `flat->flat` and `down->flat` are consistently positive.

## Forward-Looking Bias Fix

The original backtest had a critical bug: profiles from the current 5-minute window were used even though they hadn't closed yet. Fixed by using the **previous** window's profiles:

```typescript
// BEFORE (wrong - uses future data):
const windowProfileBuckets = profilesByWindow.get(windowKey(currentReadMs, 300000));

// AFTER (correct - only uses closed profiles):
const prevWindowKey = windowKey(currentReadMs - 300000, 300000);
const closedProfiles = profilesByWindow.get(prevWindowKey) ?? [];
```

Additionally, the orderflow window used `bisectRight` which included the bucket at `currentReadMs` (still forming). Fixed to use `bisectLeft`:

```typescript
// BEFORE (wrong - includes forming bucket):
const hi = bisectRight(input.orderflowBuckets, ofEnd);

// AFTER (correct - only closed buckets):
const hi = bisectLeft(input.orderflowBuckets, currentReadMs);
```

## Known Bad Paths

- **Don't optimize entry parameters** - we need signal, not optimization
- **Don't add more indicators** - we have enough
- **Don't trust R without checking win rate** - positive R with 30% win rate was untradeable before trailing stop
- **Don't use current window profiles** - always use previous window (forward bias)
- **Don't require absorption for entries** - absorption entries lose more often per separation analysis
- **Don't use `bisectRight` for orderflow window** - bucket at `currentReadMs` is still forming, use `bisectLeft`
- **Don't interpret streak analysis too strongly** - effects are exploratory, not conclusive

## What To Build Next

### Priority 1: CVD Transition Edge Validation (NEXT TASK)

**Context:** CVD transition analysis (falling->rising, high->low, etc.) was performed only on trades following losing sequences. The edge may come from the transition itself, not the losing-streak context.

**Task:** Evaluate every CVD transition in the dataset, regardless of preceding streaks. Compute expectancy, win rate, trade count, and drawdown for each transition. Compare these results to the post-losing-streak analysis to determine whether the edge comes from the transition itself or from the context in which it occurs.

**Approach:**
1. For every trade, capture the CVD state (cvdTrend, cvdMagnitude, priceDirection) at entry
2. Compare to the previous trade's CVD state (within same hypothesis)
3. Classify the transition (e.g., falling->rising, high->low)
4. Compute expectancy, win rate, count, drawdown for each transition type
5. Compare to post-losing-streak results

**CLI flag:** Add `--transition-analysis` to `scripts/backtest-market-structure.ts`

### Priority 2: Add Costs
- Bybit fees: 0.04% maker, 0.06% taker
- Slippage: ~1-2 bps per trade
- Round-trip cost: ~8-12 bps
- This will significantly reduce returns

### Priority 3: Position Sizing
- Kelly criterion or fixed fractional
- Max risk per trade: 0.5-1% of account
- Max drawdown limit: 20%

## CLI Flags

```bash
# Backtest with all defaults
bun scripts/backtest-market-structure.ts --start 2025-05-01 --end 2025-06-01

# Filter: remove rejecting entries
bun scripts/backtest-market-structure.ts --start 2025-05-01 --end 2025-06-01 --no-rejecting

# Filter: only discovering entries
bun scripts/backtest-market-structure.ts --start 2025-05-01 --end 2025-06-01 --discovering-only

# Filter: require bullish CVD divergence
bun scripts/backtest-market-structure.ts --start 2025-05-01 --end 2025-06-01 --bullish-div

# Disable trailing stop
bun scripts/backtest-market-structure.ts --start 2025-05-01 --end 2025-06-01 --no-trail

# Streak analysis
bun scripts/backtest-market-structure.ts --start 2025-05-01 --end 2025-06-01 --streak-analysis

# CVD transition analysis (post-losing-streak only)
bun scripts/backtest-market-structure.ts --start 2025-05-01 --end 2025-06-01 --state-analysis
```

## Data References

| Data | Path | Size |
|------|------|------|
| 1s buckets | `.data/market-store/bybit/trading/BTCUSDT/buckets-1s-*.parquet` | ~56MB/month |
| 5m profiles | `.data/market-store/bybit/trading/BTCUSDT/profiles-5m-*.parquet` | ~5MB/month |

Available months: May 2025 - Apr 2026 (Apr 2026 may be incomplete)
