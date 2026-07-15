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

## Backtest Results (No Forward Bias)

| Period | Trades | Win Rate | Avg R | Total R | Max DD | Avg Risk | Avg Win | Avg Loss |
|--------|--------|----------|-------|---------|--------|----------|---------|----------|
| May 2025 | 462 | 29.2% | 1.38 | 635.5 | 26.3R | 0.88 bps | +5.97 bps | -0.86 bps |
| Jun 2025 | 446 | 32.1% | 1.19 | 531.5 | 18.0R | ~0.88 bps | ~5.97 bps | -0.86 bps |

**Target >0.2 R/trade: MET** but strategy is untradeable at meaningful position sizes.

## Key Finding

The edge exists (positive R) but the strategy is **not viable** because:
- 70% loss rate means any meaningful risk % blows up the account
- Even at 1% risk/trade, 327 losses = -327% of account
- The math works on paper but not in a brokerage account

**The strategy needs a better win rate (50%+) to be tradeable.**

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
- **Don't trust R without checking win rate** - positive R with 30% win rate = untradeable
- **Don't use current window profiles** - always use previous window (forward bias)

## What To Build Next

### Priority 1: Improve Win Rate
- Better entry filters (regime, time of day, volatility)
- Tighter entry criteria (require multiple confirmations)
- Avoid entries in choppy/ranging markets

### Priority 2: Add Costs
- Bybit fees: 0.04% maker, 0.06% taker
- Slippage: ~1-2 bps per trade
- Round-trip cost: ~8-12 bps
- This will significantly reduce returns

### Priority 3: Position Sizing
- Kelly criterion or fixed fractional
- Max risk per trade: 0.5-1% of account
- Max drawdown limit: 20%

### Priority 4: More Months
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
