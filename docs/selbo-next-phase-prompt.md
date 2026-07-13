# Selbo Next Phase - Starting Prompt

## Context

We built a reader/strategy system for BTC perpetuals on Bybit. Infrastructure works, but we haven't found a real edge. Here's what we learned and what to build next.

## What We Built (Infrastructure - Keep This)

- `packages/strategy-lab` - Reader, backtest, trade plan modules
- `packages/market-data` - Bybit data ingestion, parquet storage
- `packages/live-reader` - Live reader orchestration
- Data: `.data/market-store/bybit/trading/BTCUSDT/` - 1-second buckets + 5m volume profiles (May 2025 - present)
- Backtest cache: `.data/history-cache/` - gzip-compressed history builds
- WebSocket liquidation collector: `scripts/collect-bybit-liquidations.ts`

## What We Tried (Failed - Don't Repeat)

1. **VP + Orderflow + Regime indicators** - 0.09 R/trade baseline. No predictive signal.
2. **Pre-hoc filters (trend-down, trade count)** - Benchmark claims 1.64 R/trade but can't reproduce. 0 entries on filtered data.
3. **Liquidation reaction trading** - Detected 297 "liquidations" from large trades. Fade and continuation both failed. Detection was wrong (labeling whale trades as liquidations).
4. **Self-improving loops** - Valid concept but doesn't solve the hard part: finding an edge.

## The Real Approach (What To Build)

Based on Fabio Valentini's auction market theory + orderflow reading:

### Core Concept
Read market structure in real-time. Don't predict - interpret what's happening NOW.

### Key Components

**1. Volume Profile Analysis**
- HVN (High Volume Node) = accepted value area
- LVN (Low Volume Node) = price discovery, rejection zones
- POC (Point of Control) = highest volume price
- Value Area High/Low = 70% volume range
- We have 5m volume profiles in `profiles-5m-*.parquet`

**2. Cumulative Volume Delta (CVD)**
- Running sum of (buyVolume - sellVolume)
- Divergence between price and CVD = weakness
- We have delta per 1s bucket - need to calculate cumulative

**3. Absorption Detection**
- Large aggressive orders (market orders) being absorbed by passive limit orders
- Signal: High delta + low price movement = absorption
- After absorption, price often reverses
- We have largestTradeSize and delta - need to detect absorption patterns

**4. Low Volume Node Reactions**
- Price enters LVN → should move quickly through it
- If price stalls at LVN → potential rejection/reversal
- If price accepts at LVN → new value area forming

### Entry Logic (Not Final - Needs Research)

**Setup:**
1. Identify current market structure (trending/ranging from volume profile)
2. Wait for price to reach LVN or HVN
3. Read orderflow at that level (CVD, absorption, aggression)
4. Enter when orderflow confirms rejection or acceptance

**Risk Management:**
- Stop at structure (above/below HVN or LVN)
- Target: next HVN or opposite value area
- Max 1-2% risk per trade

## Data Available

| File | Content | Size |
|------|---------|------|
| `buckets-1s-YYYY-MM.parquet` | 1s OHLCV + delta + largestTrade | ~56MB/month |
| `profiles-5m-YYYY-MM.parquet` | 5m volume profile bins | ~5MB/month |
| `detected-liquidations.json` | 297 detected "liquidations" (unreliable) | 30KB |
| `buckets-1m-may-jun-2025.json` | 1m aggregated buckets | 15MB |

## What To Build Next

### Phase 1: Market Structure Reader
1. Parse volume profiles to identify HVN, LVN, POC, VAH, VAL
2. Classify current market state (trending up/down, rotating, balanced)
3. Track POC migration (directional bias)

### Phase 2: Orderflow Reader
1. Calculate CVD from 1s bucket delta
2. Detect absorption (high delta + low price movement)
3. Classify aggression (who's in control - buyers or sellers)

### Phase 3: Integration
1. Combine structure + orderflow into a single "read"
2. The read answers: "What is the market doing RIGHT NOW?"
3. No prediction - just interpretation

### Phase 4: Backtest the Read
1. Test if reading at LVN/HVN with orderflow confirmation produces edge
2. Compare to baseline (0.09 R/trade)
3. If edge exists, optimize entry/exit

## Success Criteria

- Reader produces interpretable market state (not just indicators)
- Backtest shows >0.2 R/trade consistently across months
- Edge is understandable BEFORE entry, not just in hindsight
- Win rate doesn't matter as much as R/R ratio (target 2:1)

## Key Files to Reference

| File | Purpose |
|------|---------|
| `packages/strategy-lab/read-core/` | Current read modules (regime, orderflow) |
| `packages/strategy-lab/reader/` | Reader replay, history, hypotheses |
| `packages/market-data/parquet/` | Data loading, parquet reading |
| `scripts/collect-bybit-liquidations.ts` | Live liquidation WebSocket |
| `scripts/test-gates-backtest.ts` | Main backtest comparison |

## Do Not

- Don't add more indicators (we have enough)
- Don't optimize parameters (we need signal, not optimization)
- Don't build self-improving loops yet (need edge first)
- Don't trust benchmark results (can't reproduce them)
- Don't read `.env.local` or production env files

## Question to Answer

"What is the market doing RIGHT NOW at this price level, and what does the orderflow say about who's in control?"

That's the reader. Build that first. Then backtest. Then trade.
