# Trader Agent - Session Handoff

## What Exists Today

### Reader Pipeline (input to the trader agent)
- `buildReaderHistoryReads` produces a `LiveReaderRead` every candle: regime, auction location/kind, orderflow pressure, VP state, narrative direction/intent, local range
- `buildReaderTradePlan` produces a `ReaderTradePlan`: side, entry/stop/target, status (ready/watch/no-trade)
- The reader tells you WHAT it sees and WHAT it would do. It does NOT manage the trade lifecycle.

### Entry Filter (Q-table)
- `rl-q-table.json` (200 entries) maps reader context → enter/skip
- Learned from 66K historical candidates
- Top states: failed-expansion at value extremes, reversal-watch at above-value resistance
- Test: 2.07R/trade, 34.5% WR
- This is the PRE-ENTRY filter only. It decides whether to take the reader's setup.

### Database
- `decisions` table: action, entry, stop, target, conviction, thesis
- `evidence` table: what the reader saw (regime, auction, orderflow, price level, VP state)
- `executions` table: executed price, status (pending/filled), tx hash
- `outcomes` table: exit price, pnl (R-multiple), status (win/loss)
- Decision service, execution service, outcome service all wired
- Outcome monitor evaluates open executions on 1h candle close

### What's Missing (the trader agent)
1. **Entry execution** - currently `decision.tick.ts` creates decisions but doesn't place orders
2. **Exit management** - reader-failure exits too early (514/545 trades exit for tiny gains)
3. **Position sizing** - no risk management, no position sizing logic
4. **Trade lifecycle** - no tracking of open positions, no P&L management
5. **Multi-asset** - currently single-asset per tick

---

## What the Trader Agent Needs to Do

### 1. Entry Decision
- Receives: `LiveReaderRead` + `ReaderTradePlan` + Q-table lookup
- Decides: enter/skip, position size
- The reader provides the setup. The agent decides whether to act and how much to risk.

### 2. Exit Management (the critical missing piece)
The reader's current exit logic is broken:
- `readerFollowThroughFailed` exits on first favorable tick (bestFavorableR > 0)
- 514/545 trades exit via reader-failure with tiny gains
- Only 31 trades hit stop, almost none reach target

The trader agent needs its own exit logic:
- **Trailing stop**: move stop to breakeven after X R favorable
- **Time-based exit**: exit after N candles if no follow-through
- **Regime-shift exit**: exit if regime changes (e.g. range → trend)
- **Target management**: partial exits at target, let runner run
- **Don't exit on first adverse read**: require multiple confirming reads

### 3. Position Sizing
- Fixed fractional (% of equity per trade)
- Kelly criterion (based on win rate and avg R)
- Max drawdown gate (reduce size after consecutive losses)

### 4. Risk Management
- Max open positions per asset
- Max portfolio heat (total risk across all positions)
- Daily loss limit
- Correlation check (don't stack same-direction trades)

### 5. Trade Lifecycle
- Track entry → hold → exit
- Record outcome in DB
- Update equity curve
- Log evidence for each decision

---

## Architecture

```
Candle close (1h)
  ↓
buildReaderHistoryReads → reader read
  ↓
buildReaderTradePlan → plan (entry/stop/target)
  ↓
Q-table lookup → enter/skip decision
  ↓
[IF ENTER]
  ↓
Position sizing → risk amount
  ↓
Execute order (paper: simulate, live: Circle wallet)
  ↓
Create execution record in DB
  ↓
[WHILE HOLDING]
  ↓
On each candle close:
  - Check current price vs stop/target/trailing stop
  - Check regime change
  - Check time-in-trade
  - If exit condition met → create outcome record
  - If holding → update position state
```

---

## Key Files

| File | Purpose |
|------|---------|
| `packages/strategy-lab/reader/reader-history/build-reader-history-reads.ts` | Core reader pipeline |
| `packages/strategy-lab/reader/reader-replay/run-reader-replay.ts` | Replay engine (entry/exit tracking) |
| `packages/strategy-lab/reader/reader-result/update-reader-result.ts` | Entry filter + exit logic |
| `packages/strategy-lab/backtest/trade-plan/build-reader-trade-plan.ts` | Trade plan generation |
| `start/src/services/judgment/judgment-pipeline.ts` | Reader pipeline wired to start app |
| `start/src/services/decision/execution-service.ts` | Execution CRUD |
| `start/src/services/decision/outcome-service.ts` | Outcome CRUD + PnL calc |
| `start/src/services/judgment/outcome-monitor.ts` | Evaluates open executions |
| `start/src/routes/admin/decision.tick.ts` | Decision trigger endpoint |
| `.data/rl-q-table.json` | Trained Q-table (entry filter) |

---

## Data Available for Training

### Candidate Tapes (in `artifacts/`)
- `reader-candidates-first-reaction-r-2025-05.json` (18K candidates)
- `reader-candidates-first-reaction-r-2025-06.json` (15K candidates)
- `reader-candidates-after-vp-pullback-narrative-2025-07.json` (17K candidates)
- `reader-candidates-after-vp-pullback-narrative-2025-08.json` (16K candidates)

Each candidate has:
- `reader`: regime, auctionLocation, auctionLevelKind, auctionMode, vpAuction, vpPoc, vpValue, narrativeIntent, narrativeDirection
- `orderflow`: pressure, events, tradeCount
- `outcome`: verdict (worked/invalidated/unresolved), resultR, maxFavorableR, maxAdverseR

### Benchmark Results
- Raw replay: 545 entries, 45.5% WR, +50.51R (0.093R/trade)
- With entry filter: 250 entries, 50.4% WR, +54.12R (0.216R/trade)
- RL agent (test): 1257 entries, 34.5% WR, +2598R (2.07R/trade)
- Benchmark hypothesis: 140 entries, 40.71% WR, +229.51R (1.64R/trade)

### Key Insight from Analysis
- Winners: avg risk 96 points, auction at extremes (above-value/below-value), regime known
- Losers: avg risk 389 points, auction in intermediate zones, regime unknown
- The reader's edge is at clear extremes with tight stops
- Reader-failure exits kill most trades (thesis breaks before price moves)

---

## Open Questions for Next Session

1. **Exit logic**: Should the trader agent replace the reader's exit logic entirely, or sit on top of it? The reader's `readerFollowThroughFailed` is too aggressive. Options:
   - Modify `updateReaderResult.ts` directly (simpler, but couples exit to reader)
   - Build separate exit manager in the start app (more flexible, but duplicates logic)

2. **Position sizing**: What's the risk per trade? Kelly from the Q-table stats? Fixed fractional?

3. **Multi-asset**: The reader runs per-asset. Should the agent manage a portfolio across ETH/BTC/SOL?

4. **Latency**: 1h candle close is slow. Should the agent run on 1m or 5m reads for tighter exits?

5. **Paper vs live**: Start with paper mode (simulated fills in DB) before wiring to Circle wallet?

---

## Prompt for Next Session

I need a trader agent that:
1. Uses the reader pipeline as its eyes (what the market is doing)
2. Uses the Q-table as its filter (should I take this setup?)
3. Manages the full trade lifecycle: entry → hold → exit
4. Has its own exit logic that doesn't exit on the first adverse read
5. Sizes positions based on account risk
6. Records everything in the database (decisions, executions, outcomes)
7. Runs on candle close (1h for now, can tighten later)

The reader tells me what it sees. The Q-table tells me whether to act. I need the agent to manage the trade from entry to exit and record everything.
