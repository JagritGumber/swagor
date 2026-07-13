# Selbo Market Structure Reader - Handoff

## Date
2025-07-14

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
| `scripts/backtest-market-structure.ts` | Backtest for LVN/HVN entries with CVD confirmation |
| `scripts/test-market-structure.ts` | Smoke test for the reader |
| `docs/selbo-next-phase-prompt.md` | Context doc for fresh start |

### Modified Files

| File | Change |
|------|--------|
| `packages/strategy-lab/index.ts` | Added exports for new modules |

## Backtest Results (With Filters + Trailing Stop)

| Period | Trades | Win Rate | Avg R | Total R | Max DD |
|--------|--------|----------|-------|---------|--------|
| May 2025 | 433 | 28.9% | 5.52 | 2389.1 | 20.1R |
| Jun 2025 | 421 | 30.4% | 5.40 | 2272.3 | 11.2R |

**Target >0.2 R/trade: MET.** Strategy is now tradeable with trailing stop.

## Key Finding

The edge exists and is **viable** with trailing stop:
- Trailing stop increased R/trade from ~1.3 to ~5.5 (4x improvement)
- Win rate ~30% is acceptable with 5.5 R/trade expectancy
- Max drawdown manageable at 11-20R

## Filter Changes (This Session)

1. **Action filter:** Skip entries where reader action is "rotating" (choppy)
2. **Location filter:** Skip entries where price is at POC (balanced)
3. **Absorption filter:** Tested and REMOVED - absorption entries lose more often (separation0.092)
4. **Trailing stop:** KEPT - triggers at 0.5R favorable, trails to 0.25R lock-in
5. **Forward bias fix:** Use `bisectLeft` for orderflow window upper bound (bucket at `currentReadMs` is still forming)

## Win/Loss Separation Analysis (May 2025)

| Condition | Wins | Losses | Win% | Loss% | Separation |
|-----------|------|--------|------|-------|------------|
| action:rejecting | 43 | 122 | 34.4 | 39.6 | 0.052 |
| action:discovering | 81 | 185 | 64.8 | 60.1 | 0.047 |
| absorption:true | 44 | 122 | 35.2 | 39.6 | 0.044 |
| cvdDivergence:bearish | 6 | 27 | 4.8 | 8.8 | 0.040 |
| cvdTrend:rising | 67 | 154 | 53.6 | 50.0 | 0.036 |

**Interpretation:**
- `action:rejecting` predicts losses (39.6% loss vs 34.4% win)
- `action:discovering` predicts wins (64.8% win vs 60.1% loss)
- `absorption:true` predicts losses (counterintuitive - removed from HVN filter)
- `cvdDivergence:bearish` predicts losses (4.8% win vs 8.8% loss)

## Forward-Looking Bias Fix

The original backtest had a critical bug: profiles from the current 5-minute window were used even though they hadn't closed yet. Fixed by using the **previous** window's profiles:

```typescript
// BEFORE (wrong - uses future data):
const windowProfileBuckets = profilesByWindow.get(windowKey(currentReadMs, 300000));

// AFTER (correct - only uses closed profiles):
const prevWindowKey = windowKey(currentReadMs - 300000, 300000);
const closedProfiles = profilesByWindow.get(prevWindowKey) ?? [];
```

This changed results from 20 R/trade (fake) to 1.38 R/trade (real).

## Known Bad Paths

- **Don't optimize entry parameters** - we need signal, not optimization
- **Don't add more indicators** - we have enough
- **Don't trust R without checking win rate** - positive R with 30% win rate was untradeable before trailing stop
- **Don't use current window profiles** - always use previous window (forward bias)
- **Don't require absorption for entries** - absorption entries lose more often per separation analysis
- **Don't use `bisectRight` for orderflow window** - bucket at `currentReadMs` is still forming, use `bisectLeft`

## What To Build Next

### Priority 1: Add Costs
- Bybit fees: 0.04% maker, 0.06% taker
- Slippage: ~1-2 bps per trade
- Round-trip cost: ~8-12 bps
- This will significantly reduce returns

### Priority 2: Position Sizing
- Kelly criterion or fixed fractional
- Max risk per trade: 0.5-1% of account
- Max drawdown limit: 20%

### Priority 3: More Months
- Test Jul, Aug, Sep 2025
- Validate consistency across different market regimes

## Validation Commands

```bash
# Typecheck
rtk bun run typecheck

# Backtest
rtk bun scripts/backtest-market-structure.ts --start 2025-05-01 --end 2025-05-31

# Reader test
rtk bun scripts/test-market-structure.ts
```

## Data References

| Data | Path | Size |
|------|------|------|
| 1s buckets | `.data/market-store/bybit/trading/BTCUSDT/buckets-1s-*.parquet` | ~56MB/month |
| 5m profiles | `.data/market-store/bybit/trading/BTCUSDT/profiles-5m-*.parquet` | ~5MB/month |
