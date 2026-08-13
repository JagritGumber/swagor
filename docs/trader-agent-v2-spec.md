# Trader Agent v2 - Architecture Spec

## Philosophy

**Do not predict. Read what's happening now and respond.**

The system does not forecast where price will be. It assesses whether the current state has enough edge to act.

- **Runtime:** "Given the current market state, is there enough edge to act?"
- **Training:** "Historically, when the market looked like this, what happened afterward?"

Training uses future outcomes as supervision (labels), not because the live system forecasts the future. The live system reacts to present conditions.

---

## Problem

Current architecture chains interpretations:
```
Raw Orderflow → Reader (labels) → Trade Plan (decides) → Q-table (filters) → Exit (decides)
```

Every layer receives the previous layer's interpretation instead of raw data. Information is lost at each step.

## Proposed Architecture

```
Market Data → Measurement → Feature Engineering → State Assessment → Risk Management → Execution
```

Five layers. Each has a single responsibility. No interpretation in between.

---

## 1. Measurement Layer

**Input:** Raw data streams (orderflow trades, BBO, candles, market data)
**Output:** Raw numeric measurements per time window

### Orderflow Measurements

- `buyVolume` - total buy volume in window
- `sellVolume` - total sell volume in window
- `delta` - buyVolume - sellVolume
- `buyRatio` - buyVolume / (buyVolume + sellVolume)
- `totalVolume` - buyVolume + sellVolume
- `tradeCount` - number of trades in window
- `avgTradeSize` - average trade size
- `largestTradeSize` - size of largest trade
- `largestTradeSide` - 1 for buy, -1 for sell
- `medianTradeSize` - median trade size
- `largeTradeRatio` - volume from top 10% of trades / total volume
- `absorptionStrength` - volume absorbed at level without price movement
- `volumeAtHigh` - volume traded near candle high
- `volumeAtLow` - volume traded near candle low

### Market Measurements

- `atr` - Average True Range (14-period)
- `realizedVolatility` - standard deviation of returns over N periods
- `distanceToVWAP` - (price - VWAP) / VWAP
- `distanceToSessionHigh` - (price - session high) / session high
- `distanceToSessionLow` - (price - session low) / session low
- `fundingRate` - current funding rate (perpetuals)
- `openInterest` - current open interest
- `openInterestChange` - change in OI over window
- `liquidationVolume` - estimated liquidation volume in window

### Window Configuration

Window size is configurable per asset. Not hardcoded.

Default suggestion: 5 minutes for liquid perps, 15 minutes for less liquid assets.

### Output Format

```typescript
type Measurement = {
  timestamp: number
  windowMs: number
  // Orderflow
  buyVolume: number
  sellVolume: number
  delta: number
  buyRatio: number
  totalVolume: number
  tradeCount: number
  avgTradeSize: number
  largestTradeSize: number
  largestTradeSide: 1 | -1
  medianTradeSize: number
  largeTradeRatio: number
  absorptionStrength: number
  volumeAtHigh: number
  volumeAtLow: number
  // Market
  atr: number
  realizedVolatility: number
  distanceToVWAP: number
  distanceToSessionHigh: number
  distanceToSessionLow: number
  fundingRate: number
  openInterest: number
  openInterestChange: number
  liquidationVolume: number
}
```

---

## 2. Feature Engineering Layer

**Input:** Raw measurements (current + historical)
**Output:** Engineered features for prediction

This layer is SEPARATE from measurement. It computes derived features, rolling statistics, and normalization.

### Features to Engineer

Start with 10-15 features. Easier to debug and determine feature importance. Add more only if needed.

#### Rolling Statistics (over last N measurements)
- `deltaMA` - moving average of delta
- `deltaMomentum` - change in delta over window
- `volumeMomentum` - change in total volume over window
- `buyRatioMA` - moving average of buyRatio

#### Normalization
- `deltaZScore` - delta normalized by its rolling standard deviation
- `volumeZScore` - totalVolume normalized by its rolling standard deviation

### Output Format

```typescript
type Features = {
  timestamp: number
  symbol: string
  // Raw measurements (passthrough)
  measurement: Measurement
  // Rolling
  deltaMA: number
  deltaMomentum: number
  volumeMomentum: number
  buyRatioMA: number
  // Normalized
  deltaZScore: number
  volumeZScore: number
}
```

Price context features (distanceToVWAP, distanceToSessionHigh, distanceToSessionLow) live in Measurement only. Don't duplicate them here.

---

## 3. State Assessment Layer

**Input:** Engineered features
**Output:** Assessment of current state (is there edge?)

### What It Answers

- Is buying aggression currently dominant?
- Is liquidity being absorbed?
- Is momentum strengthening or weakening?
- Is the current state favorable for a trade?

### What It Does NOT Answer

- Where will price be in 30 minutes?
- What will the next candle look like?
- Will this trade be a winner?

### Training Approach

The State Assessment Engine learns from historical outcomes, but the live system does not forecast outcomes.

**Training target:** Future return in bps over next N candles (used as label only)
**Live output:** State score (favorable / not favorable / confidence)

The training target teaches the State Assessment Engine which states historically led to favorable outcomes. The live system uses that learned association to assess current states.

### State Assessment Engine Approach

Start simple, escalate only if needed:

1. **Logistic regression** - estimates quality of current state based on historical outcomes. Interpretable, fast, baseline.
2. **Gradient boosted trees** - if logistic isn't enough. XGBoost/LightGBM.
3. **Neural net** - only if trees aren't enough. Likely overkill.

### Training Data Format

Every measurement becomes a training sample, regardless of whether a trade was taken.

```typescript
type TrainingSample = {
  features: Features
  // Supervision label (what happened AFTER this measurement)
  futureReturnBps: number     // return in basis points over next N candles
}
```

**Key insight:** This captures what WOULD have happened, not what DID happen. Any measurement point can be evaluated retroactively. Used only for training, not for live assessment. Compute `isFavorable` during training from `futureReturnBps`, don't store it.

### State Assessment Engine Output

```typescript
type StateAssessment = {
  timestamp: number
  symbol: string
  score: number               // 0-1, quality of current state
  direction: 'long' | 'short' | 'none'  // which direction has edge
}
```

---

## 4. Risk Management Layer

**Input:** State assessment + current portfolio state
**Output:** Trade decision (enter/skip/size) + position management

This layer does NOT learn. It applies rules based on the state assessment.

### Position Sizing

Start simple:

- Fixed risk per trade (configurable % of account)
- Enter only if score exceeds threshold

Dynamic sizing (scale size with score) can be added later after proving the score is calibrated.

### Entry Decision

- Enter if state assessment score exceeds threshold
- Skip if below threshold or risk limits exceeded

### Position Management

- Update stop to breakeven after X R favorable
- Track open risk for portfolio heat calculation

### Output Format

```typescript
type RiskDecision = {
  action: 'enter' | 'skip' | 'hold'
  side: 'long' | 'short' | null
  size: number               // position size in units
  riskAmount: number         // dollar amount risked
  entryPrice: number | null
  stopPrice: number | null
  targetPrice: number | null
}
```

---

## 5. Execution Layer

**Input:** Risk decision + current market state
**Output:** Order execution + position tracking

### Responsibilities

- Place orders (paper or live)
- Track open positions
- Monitor exit conditions
- Record outcomes

### Exit Logic

Start with rule-based exits. Easier to validate. Model-based exits can be added once entries are proven.

**Rule-based exits:**
- Trailing stop (activates at X R, trails at Y R distance)
- Time exit (exit after N candles with no follow-through)
- Adverse change in measured state

### Output Format

```typescript
type Execution = {
  positionId: string
  side: 'long' | 'short'
  entryPrice: number
  entryTime: number
  size: number
  stopPrice: number
  targetPrice: number
  exitPrice: number | null
  exitTime: number | null
  exitReason: string | null
  pnl: number | null
  rMultiple: number | null
}
```

---

## 6. Storage

### Raw Measurements

Store for any future strategy to use. Include raw timestamp and symbol for sequence reconstruction:

```
.data/measurements/
  BTCUSDT/
    2025-05.parquet
    2025-06.parquet
    ...
```

### Training Samples

Store measurements + future outcomes. Include timestamp and symbol:

```
.data/training-samples/
  BTCUSDT/
    2025-05.parquet
    2025-06.parquet
    ...
```

### Trained State Assessment Engines

Version the feature schema and model to avoid breaking changes:

```
.models/
  BTCUSDT/
    measurement-schema-v1/
    feature-schema-v1/
    assessment-model-v1/
```

### Backtest Results

```
.data/backtests/
  BTCUSDT/
    2025-11-01_2025-12-31.json
    ...
```

---

## 7. Data Flow Summary

### Training

```
Historical Orderflow Buckets
    ↓
Measurement Layer (configurable window)
    ↓
Feature Engineering (rolling, normalized)
    ↓
Label with future outcomes (used only for training)
    ↓
Train State Assessment Engine
    ↓
Save Engine + Training Data
```

### Live Trading

```
Live Orderflow Stream
    ↓
Measurement Layer
    ↓
Feature Engineering
    ↓
State Assessment Engine → score, direction
    ↓
Risk Management → enter/skip/size
    ↓
Execution → place order
    ↓
Exit Monitor → check exit conditions
    ↓
Record outcome
```

### Backtest

```
Historical Orderflow Buckets
    ↓
Measurement Layer
    ↓
Feature Engineering
    ↓
State Assessment Engine → score per measurement
    ↓
Risk Management → simulate entries/exits
    ↓
Record outcomes
    ↓
Calculate metrics
```

---

## 8. What Changes vs v1

| Component | v1 | v2 |
|-----------|----|----|
| Input | Reader labels | Raw orderflow + market data |
| Features | 6 categorical strings | ~25 continuous numbers |
| Assessment | None (Q-table filters reader) | State Assessment Engine evaluates current state |
| Risk | Fixed fractional | Fixed risk + score threshold |
| Training | Candidate tapes with labels | Raw measurements + future outcomes (supervision only) |
| Exit | Rule-based on reader labels | Rule-based on measurements |
| Pipeline | 5 layers (interpretation chain) | 5 layers (measure → engineer → assess → risk → execute) |
| Philosophy | Predict and filter | Read and respond |

---

## 9. Success Criteria

Define BEFORE building. Not after.

### Backtest Metrics

- **Average return per trade:** >50 bps
- **Positive expectancy:** avg win > avg loss
- **Profit factor:** >1.5
- **Sharpe ratio:** >1.0
- **Sortino ratio:** >1.5
- **Max drawdown:** <10% of account
- **Trade frequency:** >5 trades per week

### Edge Persistence

- Results must hold on 3+ months of unseen data
- No significant degradation from training to test period

### Sanity Checks

- State Assessment Engine should not enter every trade (should filter)
- State Assessment Engine should not enter only one direction (should be symmetric)
- Scores should vary (not constant)

---

## 10. Open Questions

1. **Assessment target** - Future return in bps? Pick one.
2. **Window size** - Start with 5m. Validate architecture before tuning.
3. **Feature count** - Start with ~10 features. Add more only if needed.
4. **Training frequency** - Retrain after every X new labeled samples (configurable).
5. **Multi-asset** - One State Assessment Engine per asset initially. Validate feature distributions before sharing.
6. **Exit approach** - Rules first, model-based later.
7. **Paper vs live** - Paper first. How long before live?
8. **Latency** - Measurement + assessment + execution must complete before the next window closes.

---

## 11. Priority (Before Implementation)

1. **Define assessment target** - future return in bps
2. **Design training dataset** - measurements + futureReturnBps
3. **Separate assessment from risk** - engine outputs score, risk decides size
4. **Split measurement from feature engineering** - raw numbers vs derived features
5. **Make window size configurable** - not hardcoded
6. **Version schemas** - measurement-schema-v1, feature-schema-v1, assessment-model-v1

Everything else can be iterated on later.
