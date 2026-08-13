# Reader Backtest Pipeline

How the reader hypothesis artifacts were generated and how to reproduce them.

## Data Source

Bybit 1-second orderflow bucket Parquet files stored locally:

```
.data/market-store/bybit/trading/BTCUSDT/
  buckets-1s-YYYY-MM.parquet   (1s aggregate trade buckets)
  profiles-5m-YYYY-MM.parquet  (5m volume profile snapshots)
  manifest.json                 (month index, row counts, date ranges)
```

Current data: 2025-05 through 2026-04 (12 months, ~60MB/month buckets).

The benchmark artifacts used **2025-05 through 2025-10** (6 months, BTCUSDT only).

## Pipeline Stages

### Stage 1: Candidate Tape Generation

Orchestrator script processes one month at a time, spawning the replay engine:

```powershell
cd .worktrees/reader-high-r-restart

bun --conditions react-server scripts/evaluate-bybit-parquet-candidate-tapes.ts `
  --symbol BTCUSDT `
  --start-month 2025-05 `
  --end-month 2025-10 `
  --mode rolling `
  --market-store-root .data/market-store `
  --bucket-event-mode aggregate `
  --chunk-days `
  --out-dir docs/strategy-lab/candidate-tapes
```

This spawns `evaluate-orderflow-poc.ts` per month, which:
1. Reads Parquet buckets via `readOrderflowBuckets()`
2. Builds candles from 1s aggregates
3. Converts to `OrderflowEvent[]`
4. Runs `runReaderHistoryReplay()` (full reader pipeline)
5. Writes candidate tape JSON to `--candidate-tape-out`

Output: `docs/strategy-lab/candidate-tapes/btcusdt-rolling-YYYY-MM.json` per month.

### Stage 2: Score Report

Reads all candidate tapes and ranks hypotheses:

```powershell
bun --conditions react-server scripts/report-reader-hypothesis-score.ts `
  --tapes docs/strategy-lab/candidate-tapes/btcusdt-rolling-2025-05.json,docs/strategy-lab/candidate-tapes/btcusdt-rolling-2025-06.json,docs/strategy-lab/candidate-tapes/btcusdt-rolling-2025-07.json,docs/strategy-lab/candidate-tapes/btcusdt-rolling-2025-08.json,docs/strategy-lab/candidate-tapes/btcusdt-rolling-2025-09.json,docs/strategy-lab/candidate-tapes/btcusdt-rolling-2025-10.json `
  --round-trip-cost-bps 1 `
  --bootstrap-samples 1000 `
  --bootstrap-seed 42 `
  --label restart-score-cost-1bps `
  --out artifacts/restart-score-cost-1bps.md
```

### Stage 3: Additional Reports (same input)

| Script | Output | Purpose |
|--------|--------|---------|
| `report-reader-hypotheses.ts` | `restart-combined-cost-1bps-fresh.md` | Full breakdown by month/family/regime |
| `report-reader-hypothesis-stability.ts` | `restart-stability-cost-1bps-fresh.md` | Monthly stability, train/test split |
| `report-reader-hypothesis-inspection.ts` | `restart-top3-inspection-cost-1bps.md` | Trade-by-trade inspection for top 3 |
| `report-reader-hypothesis-monte-carlo.ts` | `restart-top3-monte-carlo-cost-1bps.md` | 10K Monte Carlo, ruin analysis |
| `report-reader-absorption-equal-trades.ts` | `restart-absorption-equal-trades-cost-1bps.md` | 51 absorption variants at equal trade counts |

All use `--tapes <same-tape-list>` and `--round-trip-cost-bps 1`.

## Benchmark Results (2025-05 to 2025-10)

102,183 candidates evaluated across 184 days. Top hypothesis:

| Hypothesis | Entries | Total R | Win Rate | Max DD |
|---|---:|---:|---:|---:|
| vp-trend-down-active-price-follow-025 | 140 | +229.51R | 40.71% | -11.17R |
| vp-confirmed-absorption-trend-down-price-follow-025 | 41 | +140.91R | 56.1% | -4.15R |
| vp-active-long-first-reaction-nonnegative | 249 | +334.84R | 36.14% | -18.68R |
| trend-pullback-continuation-price-follow-025 | 200 | +170.73R | 27.5% | -27.39R |
| trend-pullback-long-thin-immediate | 113 | +161.08R | 46.02% | -31.75R |

## Reproducing the Benchmark

To reproduce from scratch:

1. Ensure `.data/market-store/bybit/trading/BTCUSDT/` has Parquet files for 2025-05 through 2025-10
2. Run Stage 1 to generate candidate tapes
3. Run Stage 2 to generate the score report
4. Compare output against `artifacts/restart-score-cost-1bps.md`

To run on the full 12-month dataset (2025-05 through 2026-04), change `--end-month 2026-04`.

## Key Configuration

| Parameter | Value | Source |
|---|---|---|
| Venue | bybit | Parquet files |
| Symbol | BTCUSDT | Parquet files |
| Narrative session mode | rolling | `--mode rolling` |
| Bucket event mode | aggregate | `--bucket-event-mode aggregate` |
| Read interval | 60s | Default in `evaluate-orderflow-poc.ts` |
| Orderflow window | 300s | Default |
| Profile candles | 120 | Default in `buildReaderHistoryReads` |
| Round-trip cost | 1bps | `--round-trip-cost-bps 1` |
| Bootstrap samples | 1000 | `--bootstrap-samples 1000` |
| Bootstrap seed | 42 | `--bootstrap-seed 42` |
| Setup TTL | 900s | Default |

## Candidate Tape Format

Each JSON file contains:

```json
{
  "run": { "startAt": "...", "endAt": "...", "venue": "bybit", "dataMode": "parquet", ... },
  "summary": { "candidates": 102183, ... },
  "assets": [{
    "asset": "BTCUSDT",
    "tape": {
      "summary": { "candidates": N, "worked": X, "invalidated": Y, ... },
      "candidates": [
        {
          "index": 1,
          "observedAt": "2025-05-01T...",
          "family": "trend-continuation",
          "side": "long",
          "entryPrice": 100,
          "target": 104,
          "invalidation": 99,
          "resultR": 3,
          "maxFavorableR": 3,
          "invalidationBps": 100,
          "reader": { ... },
          "orderflow": { ... }
        }
      ]
    }
  }]
}
```
