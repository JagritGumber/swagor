# Trader Agent - Session Handoff

## What We Solved

### Backtest Performance

The backtest was too slow to test on meaningful sample sizes. 14-day runs timed out at 10 minutes.

**Root causes found:**
1. `snapshotResultUpdate()` deep-copied entire `ReaderResultState` on every tick - quadratic scaling
2. `Math.max(...candles.map(...))` in `localRangeFor()` created millions of temporary arrays
3. `candles.filter()` in `readMarketRegime()` created new arrays on every tick
4. `sizes.sort()` in `tapeStats()` sorted trade sizes on every tick
5. Test script ran full pipeline twice (baseline + gated), doubling total time

**Optimizations applied:**

| File | Change | Impact |
|------|--------|--------|
| `reader-replay/run-reader-replay.ts` | Added `skipResultSnapshots` flag | Eliminated quadratic bottleneck |
| `reader-replay/types.ts` | Added `skipResultSnapshots` to input type | |
| `reader-history/build-reader-history-reads.ts` | Replaced `Math.max(...map())` with loop in `localRangeFor` | Eliminated millions of temp arrays |
| `read-core/market-regime/read-market-regime.ts` | Replaced `candles.filter()` with index iteration | Eliminated per-tick array copy |
| `read-core/orderflow/read-orderflow-window.ts` | Replaced `sizes.sort()` with approximate median/rank | Eliminated O(n log n) per tick |
| `live-reader/run-market-store-reader-replay-report.ts` | Added `skipResultSnapshots` passthrough | |
| `scripts/test-gates-backtest.ts` | Rewritten to share data load + history build | Halved total time |
| All backtest scripts | Added `skipResultSnapshots: true` | |

### History Cache

The history build (per-tick computation) is the most expensive step. Cache stores the output as gzip-compressed JSON so subsequent runs skip the build entirely.

**Cache module:** `packages/strategy-lab/reader/reader-history/history-cache.ts`

**How it works:**
1. `historyCacheKeyFor()` computes a deterministic key from build params (asset, interval, readIntervalMs, date range, auctionConfig)
2. `loadHistoryCache()` checks if `.data/history-cache/{key}.json.gz` exists
3. `saveHistoryCache()` writes gzip-compressed JSON
4. `buildOrLoadHistorySteps()` wraps the whole flow: load if hit, build + save if miss

**Performance:**

| Run | Build (first time) | Cache hit | Cache size |
|-----|-------------------|-----------|------------|
| 7-day | 64s | 16s | 40 MB |
| 14-day | 237s | 89s | 83 MB |

The remaining time on cache hit is parquet data loading from disk (the I/O floor).

## How To Use

### Running a backtest

```powershell
# Basic 7-day backtest (uses cache automatically)
bun run scripts/test-gates-backtest.ts --start 2025-05-01 --end 2025-05-07

# 14-day backtest
bun run scripts/test-gates-backtest.ts --start 2025-05-01 --end 2025-05-14

# Force rebuild (skip cache)
bun run scripts/test-gates-backtest.ts --start 2025-05-01 --end 2025-05-07 --no-cache
```

### Running monthly backtests

```powershell
# Single month
bun run scripts/run-backtest-1month.ts

# Multi-month comparison (raw vs filtered)
bun run scripts/run-backtest-filtered.ts

# Multi-month with all filters combined
bun run scripts/run-backtest-filtered-combined.ts

# Full 6-month comparison
bun run scripts/run-backtest-compare.ts

# R distribution analysis
bun run scripts/run-backtest-distribution.ts
```

### Cache management

Cache lives at `.data/history-cache/`. Add to `.gitignore` if not already there.

```powershell
# Check cache files
Get-ChildItem .data/history-cache | ForEach-Object { "$($_.Name): $([math]::Round($_.Length / 1MB, 1)) MB" }

# Clear all cache
Remove-Item .data/history-cache\* -Force

# Clear specific cache (e.g., for a date range)
Remove-Item ".data/history-cache\BTCUSDT_5m_*start=1746057600000*.json.gz" -Force
```

### Using cache in your own scripts

```typescript
import { buildReaderHistoryReads } from "@strategy-lab/reader/reader-history/build-reader-history-reads";
import { buildOrLoadHistorySteps } from "@strategy-lab/reader/reader-history/history-cache";
import { runReaderReplay } from "@strategy-lab/reader/reader-replay/run-reader-replay";

const { steps, fromCache } = buildOrLoadHistorySteps(
  {
    asset: "BTCUSDT",
    interval: "5m",
    candleIntervalMs: 300_000,
    candles,
    orderflowEvents,
    readIntervalMs: 5000,
    orderflowWindowMs: 60_000,
    startAt: startMs,
    endAt: endMs,
  },
  (input) => buildReaderHistoryReads(input),
);
console.log(`History ${fromCache ? "from cache" : "built"}: ${steps.length} steps`);

// Run multiple replays on the same history
const baseline = runReaderReplay({ reads: steps, requireTimestamps: true, setupConfig: {}, skipResultSnapshots: true });
const gated = runReaderReplay({ reads: steps, requireTimestamps: true, setupConfig: { tradePlanConfig: { allowedRegimes: ["trend-down"] } }, skipResultSnapshots: true });
```

### Pre-Hoc Gates

Filter trades at setup time (not post-hoc):

```typescript
setupConfig: {
  tradePlanConfig: {
    allowedRegimes: ["range", "trend-up"],
    minTradeCount: 10,
    maxTradeCount: 100,
  },
},
```

## Data Available

- `.data/market-store/bybit/trading/BTCUSDT/` - Parquet files May-September 2025
- Regimes in data: `range`, `trend-up` (no `trend-down` in May)
- Trade counts: avg 25 per bucket, range 1-3182

## Commands

Typecheck:
```powershell
bun run typecheck
```

Run tests:
```powershell
bun test packages/strategy-lab/reader/reader-replay/run-reader-replay.test.ts
```

## What Failed (Previous Session)

1. **Post-hoc VP-following:** Hindsight, not edge
2. **Monte Carlo VP-following:** High ruin probability (53-84%)
3. **Tighter loss filters:** Didn't reduce maxDD, increased ruin
4. **Pre-Hoc gates on small samples:** Edge too thin, likely noise

## 6-Month Results (May-Oct 2025)

Full backtest with default reader (no filters):

| Month | Time | Entries | Win | R |
|-------|------|---------|-----|-----|
| 2025-05 | 248.3s | 83 | 27 | +16.54 |
| 2025-06 | 143.6s | 86 | 40 | +5.34 |
| 2025-07 | 202.6s | 89 | 41 | +1.94 |
| 2025-08 | 242.2s | 100 | 47 | +6.12 |
| 2025-09 | 126.7s | 97 | 49 | +6.17 |
| 2025-10 | 197.4s | 88 | 43 | +14.58 |
| **Total** | **1160.8s** | **543** | **247** | **+50.70R** |

- Win rate: 45.49%
- Max drawdown: -7.08R
- R/trade: 0.09R

### Key Finding: Selectivity Is The Edge

Benchmark `vp-trend-down-active-price-follow-025` (184 days):
- 140 trades, +229.51R, 40.71% win rate
- R/trade: 1.64R (18x better than default)

The benchmark's filters:
- `regime: "trend-down"` - only trade in downtrends
- `minInvalidationBps: 2, maxInvalidationBps: 5` - tight invalidation
- `minTradeCount: 500, maxTradeCount: 1000` - active orderflow
- `max-favorable confirmation at 0.25R` - wait for price confirmation

The edge is not in the reader itself but in the filter that selects which setups to trade. The reader generates candidates; the filter selects quality over quantity.

## Validation Results

### Benchmark Filter Produces 0 Entries

The benchmark filter `trend-down + trade count 500-1000` produces **0 entries** on all tested months (May-Sep 2025).

**Root cause:** No `trend-down` regimes detected in the data. The regime classifier requires:
- `driftPct >= 1%` (directional drift)
- `directionalEfficiency >= 0.42` (drift/range ratio)
- Both conditions must hold for the same sign

In the tested data, BTC price action stays in `range` or `trend-up` regimes. The benchmark's trend-down filter is too restrictive for this dataset.

### Baseline R/Trade Varies Significantly

| Month | Entries | Win Rate | Total R | R/Trade |
|-------|---------|----------|---------|---------|
| May (train) | 268 | 35.1% | +66.54R | 0.2483 |
| Jun (train) | 274 | 38.3% | +11.31R | 0.0413 |
| Jul (train) | 334 | 41.0% | +16.09R | 0.0482 |
| Aug (test) | 302 | 39.4% | +78.60R | 0.2603 |

R/trade ranges from 0.04 to 0.26 - highly variable month-to-month.

### Key Finding

The benchmark's reported 1.64 R/trade over 184 days is **not reproducible** with the current data and filters. Either:
1. The benchmark was evaluated on different data (different date range, different regime detection)
2. The candidate-tape evaluation method differs from the replay-based backtest
3. The benchmark is overfit to a specific subset of data

### What's Next

1. **Reconcile evaluation methods** - The benchmark uses candidate tapes (pre-computed setups), while the backtest uses live replay. These produce different results.
2. **Regime coverage** - Check if trend-down regimes exist in other date ranges or with different classification thresholds
3. **Simpler edge** - The baseline R/trade is 0.04-0.26. Finding a consistent edge above 0.1 R/trade across months is the real goal

## Key Files

| File | Purpose |
|------|---------|
| `scripts/test-gates-backtest.ts` | Main backtest script (baseline vs gated comparison) |
| `scripts/run-backtest-compare.ts` | 6-month comparison |
| `scripts/run-backtest-filtered.ts` | Filter comparison across months |
| `scripts/run-backtest-distribution.ts` | R distribution and trade analysis |
| `packages/strategy-lab/reader/reader-history/history-cache.ts` | Cache module |
| `packages/strategy-lab/reader/reader-history/build-reader-history-reads.ts` | History build (hot path) |
| `packages/strategy-lab/reader/reader-replay/run-reader-replay.ts` | Replay engine |
| `packages/strategy-lab/backtest/trade-plan/build-reader-trade-plan.ts` | Trade plan with gates |

Do not read `.env.local` or production env files.
