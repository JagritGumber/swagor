# Market Story Engine - Architecture Design

## Date
2025-07-14

## Status
Design only. No implementation.

---

## 1. What Is a Market Story?

### Formal Definition

A **market story** is a directed, temporally-ordered sequence of discrete market events, where each event represents a qualitative change in the state of order flow, price discovery, or participant behavior. A story is not a snapshot; it is a trajectory.

The key distinction from scalar features: a story encodes *what changed and in what order*, not *what the current value is*.

### Smallest Unit: The Micro-Event

The atomic unit is a **micro-event**: a single, observable change in market behavior that occupies a discrete moment in time. Examples:

- A trade that lifts the offer
- A trade that hits the bid
- BBO spreads widening
- Trade rate increasing above a threshold
- A large print that is 3x the median

Micro-events are raw observations. They carry no interpretation.

### Event

An **event** is a micro-event enriched with context. It answers: *what does this micro-event mean given what just happened?*

| Micro-Event | Context | Event |
|-------------|---------|-------|
| Trade lifts offer | Selling was accelerating | Absorption attempt |
| Trade lifts offer | Buying was accelerating | Initiative continuation |
| BBO spread widens | High trade rate | Liquidity withdrawal |
| Large sell print at bid | Price held at support | Defensive absorption |

The same micro-event produces different events depending on the preceding state. This is the core insight the current system loses.

### State

A **state** is a persistent condition of the market that holds across multiple events. States have duration. Examples:

- `selling-pressure`: Sustained sell-side initiative over multiple ticks
- `absorption`: Sustained defense of a level despite pressure
- `balance`: No directional initiative for a defined period
- `discovery`: Price exploring new territory with increasing participation

A state begins when a transition condition is met and ends when the next transition fires. States are not momentary; they persist until displaced.

### Transition

A **transition** is the boundary between two states. It is the moment the market *changes its mind*. Transitions are detected, not assumed.

Example transition: `selling-pressure` → `absorption` is detected when:
1. Sell initiative was present (prior state)
2. Price stops declining despite continued selling
3. Trade size distribution shifts (large prints appear at the bid)
4. BBO depth shifts (bid thickens)

A transition carries:
- `from`: the departing state
- `to`: the arriving state
- `trigger`: the event(s) that caused the transition
- `confidence`: how clearly the transition is detected (weak / standard / strong)
- `timestamp`: when the transition occurred

### Sequence

A **sequence** is an ordered list of transitions that forms a complete narrative arc. A sequence has:

- `onset`: the first event that began the current story
- `transitions`: the ordered list of state changes
- `current`: the present state
- `duration`: how long the current state has persisted
- `intensity`: a composite measure of participation, volume, and speed
- `resolution`: whether the story has reached a conclusion (entry, exit, invalidation)

Example sequence:

```
selling-pressure (45s, intensity:high)
  → absorption (12s, intensity:medium)
    → balance (8s, intensity:low)
      → initiative-buying (ongoing, intensity:rising)
```

This is the "story" that a human reads. It is what the engine must produce.

---

## 2. Event Vocabulary

### Current Vocabulary Critique

The current orderflow reader produces ~70 events per trade through `eventLabels()`. The current vocabulary includes:

- `large-print`
- `lifting-offers`
- `hitting-bids`
- `stalled-buying`
- `stalled-selling`
- `buy-absorption`
- `sell-absorption`
- `confirmed-absorption`
- `aggressive-absorption`
- `thin-follow-through`

**Why this is too many:**

1. **Neutral events dominate.** Most ticks are noise. Emitting an event for every tick means the signal is buried in a stream of "nothing happened" labels. The reader currently emits `thin-follow-through` as a catch-all when nothing else matches - this is the most common event and carries zero information.

2. **Events are not composable.** `stalled-buying` + `buy-absorption` + `confirmed-absorption` are three labels that describe one phenomenon. A human would say "buyers are being absorbed." The current system produces three separate events that a downstream consumer must reconcile.

3. **Events lack temporal meaning.** `large-print` at tick 1 and `large-print` at tick 100 produce the same label. The system cannot distinguish "a large print appeared during rising selling pressure" from "a large print appeared during balance."

4. **No hierarchy.** All events exist at the same level of abstraction. There is no way to ask "what is the market doing at a high level?" without re-deriving it from raw events.

**What a good event vocabulary should look like:**

- **Small.** 8-15 event types, not 70.
- **Composable.** Each event describes one qualitative change, not a combination of conditions.
- **Hierarchical.** Events exist at multiple levels of abstraction.
- **Temporal.** The same event type means different things depending on what preceded it (this is handled by state, not event type).
- **Distinct.** Each event type is clearly different from every other type. No synonyms.

### Proposed Vocabulary

**Level 1 - Primitives (detected from raw data):**

| Event | Detection |
|-------|-----------|
| `initiative` | One side carries >65% of volume in a window |
| `absorption` | Price holds despite directional volume |
| `exhaustion` | Trade rate declines while price moves in direction |
| `print` | A single trade >3x median size |
| `gap` | BBO spread widens significantly |
| `silence` | Trade rate drops below minimum threshold |

These are the only raw events the engine emits. Everything else is derived from sequences of these.

**Level 2 - Composite (derived from Level 1 sequences):**

| Composite | Primitive Sequence |
|-----------|-------------------|
| `pressure` | `initiative` sustained for N seconds |
| `defense` | `absorption` following `initiative` against |
| `exhaustion` | `exhaustion` following `pressure` |
| `liquidity-event` | `gap` or `silence` during `pressure` |
| `climax` | `print` + `initiative` + `exhaustion` in rapid succession |

**Level 3 - Narrative (derived from Level 2 sequences):**

| Narrative | Composite Sequence |
|-----------|-------------------|
| `squeeze` | `pressure` → `defense` → `exhaustion` → `initiative` (opposite side) |
| `breakout` | `pressure` → `gap` → `initiative` (continuation) |
| `trap` | `initiative` → `exhaustion` → `defense` (opposite side) |
| `acceptance` | `pressure` → `defense` → `silence` → `initiative` (same side as defense) |
| `rejection` | `pressure` → `defense` → `initiative` (opposite side, fast) |

This vocabulary has 6 primitives, 5 composites, and 5 narratives. Total: 16 event types across 3 levels. Down from ~70.

---

## 3. Hierarchy

### Yes, Events Should Exist at Multiple Levels

The hierarchy serves two consumers:

1. **The state machine** operates on Level 1 primitives. It needs raw, composable inputs.
2. **The entry logic** operates on Level 3 narratives. It needs human-readable context.
3. **The ML model** (future) operates on whatever representation is most information-dense. Likely Level 2 composites.

### Level 1: Primitives

These are detected directly from order flow data. Each primitive is a binary detector: either the condition is met or it is not. No ambiguity.

Primitives are cheap to compute and produce a high-frequency stream (one per tick or window).

### Level 2: Composites

These are detected from sequences of primitives. A composite has a *setup phase* (the primitives that preceded it) and a *confirmation phase* (the primitives that validated it).

Composites are the core vocabulary of the state machine. They are what transitions are defined in terms of.

### Level 3: Narratives

These are the "stories" that humans read. A narrative is a complete arc: onset → development → climax → resolution.

Narratives are what the entry logic consumes. They are the output of the story engine.

### Why Three Levels?

- **Level 1** preserves maximum information but is too noisy for decision-making.
- **Level 3** is human-readable but loses nuance.
- **Level 2** is the balance: abstract enough to be meaningful, detailed enough to be actionable.

The state machine operates on Level 2. The entry logic consumes Level 3. Level 1 exists for the state machine's internal use.

---

## 4. State Machine

### Yes, the Market Should Be Represented as a State Machine

The current system treats each tick independently. The state machine provides what the current system lacks: *memory of what just happened*.

### States

| State | Description | Duration |
|-------|-------------|----------|
| `idle` | No directional initiative, low participation | Variable |
| `buying` | Sustained buy-side initiative | 10s-5min |
| `selling` | Sustained sell-side initiative | 10s-5min |
| `absorbing-buy` | Buying is being absorbed (price holds despite buy initiative) | 5-30s |
| `absorbing-sell` | Selling is being absorbed (price holds despite sell initiative) | 5-30s |
| `exhausting-buy` | Buying is losing momentum (trade rate declining, price stalling) | 5-20s |
| `exhausting-sell` | Selling is losing momentum (trade rate declining, price stalling) | 5-20s |
| `discovering` | Price moving into new territory with participation | 10s-2min |
| `trapping` | Failed initiative followed by opposite-side response | 5-15s |

### Transitions

Transitions are defined as conditions that must hold for a minimum duration (hysteresis) to prevent noise-triggered state changes.

```
idle → buying:     buy initiative sustained >5s
idle → selling:    sell initiative sustained >5s
buying → idle:     no initiative for >10s
buying → absorbing-buy:  price stalls despite buy initiative >5s
buying → exhausting-buy: trade rate declines >30% from peak while buying
buying → discovering:    price breaks above recent high with participation
selling → idle:    no initiative for >10s
selling → absorbing-sell: price stalls despite sell initiative >5s
selling → exhausting-sell: trade rate declines >30% from peak while selling
selling → discovering:   price breaks below recent low with participation
absorbing-buy → buying:  buy initiative resumes with price advance
absorbing-buy → idle:    no initiative for >10s
absorbing-buy → trapping: sell initiative appears and fails
absorbing-sell → selling: sell initiative resumes with price decline
absorbing-sell → idle:   no initiative for >10s
absorbing-sell → trapping: buy initiative appears and fails
exhausting-buy → idle:   no initiative for >10s
exhausting-buy → trapping: opposite initiative appears
exhausting-sell → idle:  no initiative for >10s
exhausting-sell → trapping: opposite initiative appears
discovering → buying:    price finds acceptance, initiative continues
discovering → selling:   price finds acceptance, initiative continues
discovering → idle:      participation dries up
trapping → buying:       trapped side capitulates, opposite initiative resumes
trapping → selling:      trapped side capitulates, opposite initiative resumes
trapping → idle:         both sides withdraw
```

### How Transitions Are Detected

Each transition has a **detector function** that takes the current window of order flow data and returns:

- `detected: boolean` - whether the transition condition is met
- `confidence: number` - 0.0 to 1.0, how clearly the condition is met
- `duration: number` - how long the condition has been holding

The detector uses:
1. **Primitive events** from Level 1 (initiative, absorption, exhaustion, etc.)
2. **Persistence threshold** - the condition must hold for N seconds (varies by transition)
3. **Hysteresis** - once a transition fires, the engine enters a cooldown period where the same transition cannot fire again immediately
4. **Intensity tracking** - the state machine tracks the intensity of the current state (participation rate, volume, price velocity) to distinguish strong states from weak ones

---

## 5. Story Extraction

Given 120 seconds of raw order flow (potentially thousands of updates), the engine must compress this into a concise story.

### Pipeline

```
Raw Trades + BBO
  ↓
[1] Segmentation
  ↓
[2] Change-Point Detection
  ↓
[3] Event Merging
  ↓
[4] State Machine
  ↓
[5] Story Extraction
  ↓
Narrative Output
```

### Step 1: Segmentation

Divide the raw stream into **windows** of configurable size (default: 5 seconds). Within each window, compute Level 1 primitives.

This is analogous to the current `readOrderflowWindow()` but produces primitive events instead of scalar summaries.

### Step 2: Change-Point Detection

Detect moments where the statistical properties of the stream change. Methods:

- **Trade rate change**: Sudden increase or decrease in trades per second
- **Size distribution change**: Shift in median trade size
- **Side imbalance change**: Shift in buy/sell ratio
- **BBO change**: Significant spread widening or depth shift

Change points are candidates for state transitions. They are not transitions themselves; they are *signals* that a transition may be occurring.

### Step 3: Event Merging

Merge consecutive primitives into composite events using the Level 2 vocabulary. Rules:

- `initiative` sustained >5s → `pressure`
- `absorption` following `pressure` → `defense`
- `exhaustion` following `pressure` → `exhaustion`
- `print` + `initiative` + `exhaustion` within 3s → `climax`

Merging uses **persistence thresholds**: the primitive must be present for a minimum duration before it qualifies as a composite.

### Step 4: State Machine

Feed merged composites into the state machine. The state machine:

1. Detects transitions (using the detector functions described in Section 4)
2. Applies hysteresis (cooldown after transitions)
3. Tracks intensity within states
4. Produces a sequence of state transitions

### Step 5: Story Extraction

From the state machine output, extract the narrative. Rules:

- **Minimum story length**: Ignore sequences with fewer than 2 transitions (noise)
- **Intensity filter**: Ignore states with intensity below a threshold
- **Resolution**: Mark stories that reached a conclusion (entry, exit, invalidation)
- **Recency weight**: Weight recent transitions more heavily than older ones

### Why These Specific Techniques?

- **Segmentation** is necessary because raw trade data is too high-frequency (hundreds per second) for state machine logic.
- **Change-point detection** reduces false transitions by requiring statistical evidence of change, not just threshold crossings.
- **Event merging** compresses the primitive stream into the composite vocabulary the state machine understands.
- **Persistence thresholds** prevent noise-triggered transitions. A 1-second initiative spike is not "buying."
- **Hysteresis** prevents oscillation between states. Once the machine enters `buying`, it stays there until a clear transition signal appears.

---

## 6. Sequence Representation

### Candidate Representations

**1. Ordered Event List**

```
[
  { time: 0, event: "initiative", side: "sell", intensity: 0.8 },
  { time: 5, event: "absorption", side: "buy", intensity: 0.6 },
  { time: 12, event: "exhaustion", side: "sell", intensity: 0.4 },
  { time: 18, event: "initiative", side: "buy", intensity: 0.7 },
]
```

- **Preserves**: Temporal order, event types, intensity
- **Destroys**: State-level abstraction (must be re-derived)
- **Use case**: Input to ML models, debugging

**2. State Transition List**

```
[
  { from: "idle", to: "selling", at: 0, duration: 45 },
  { from: "selling", to: "absorbing-sell", at: 45, duration: 12 },
  { from: "absorbing-sell", to: "buying", at: 57, duration: 23 },
]
```

- **Preserves**: State abstraction, transitions, durations
- **Destroys**: Sub-state detail (what happened within each state)
- **Use case**: Entry logic, human-readable reports

**3. Directed Graph**

```
Nodes: states
Edges: transitions (weighted by frequency, intensity)
```

- **Preserves**: Transition probabilities, state relationships
- **Destroys**: Temporal ordering (graph is time-agnostic)
- **Use case**: Market regime analysis, strategy backtesting over long periods

**4. Finite State Machine Trace**

```
{
  states: ["idle", "selling", "absorbing-sell", "buying"],
  transitions: [
    { from: 0, to: 1, trigger: "pressure", time: 0 },
    { from: 1, to: 2, trigger: "defense", time: 45 },
    { from: 2, to: 3, trigger: "initiative", time: 57 },
  ],
  current: 3,
  duration: 23,
  intensity: 0.7,
}
```

- **Preserves**: Everything. Full state machine trace with triggers and timing.
- **Destroys**: Nothing, but is verbose.
- **Use case**: Primary representation for the story engine.

**5. Hierarchical Tree**

```
Story
  Phase 1: Pressure (selling, 45s)
    Events: initiative(0s), initiative(5s), initiative(10s)...
  Phase 2: Defense (absorbing, 12s)
    Events: absorption(45s), print(48s), absorption(51s)...
  Phase 3: Reversal (buying, 23s)
    Events: initiative(57s), initiative(62s)...
```

- **Preserves**: Hierarchical structure, phase-level summary, event detail
- **Destroys**: Cross-phase temporal relationships (phases appear sequential, but overlap is hidden)
- **Use case**: Human-readable reports, narrative generation

**6. Timeline**

```
0s -------- 45s -------- 57s -------- 80s
|  selling  | absorbing  |   buying   |
| pressure  |  defense   | initiative |
```

- **Preserves**: Visual clarity, duration, phase boundaries
- **Destroys**: Internal detail within phases
- **Use case**: Visualization, quick scanning

### Recommendation

Use **FSM Trace** as the primary representation (it preserves everything), with **State Transition List** as the serialization format for storage and ML input. The hierarchical tree is produced on-demand for human-readable reports.

---

## 7. Machine Learning

### What Each Representation Preserves or Destroys for ML

| Representation | Temporal Order | State Abstraction | Sub-State Detail | Transition Triggers | ML Suitability |
|---------------|----------------|-------------------|------------------|--------------------|----|
| Ordered Event List | Yes | No | Yes | No | Good for sequence models (RNN, Transformer) |
| State Transition List | Yes | Yes | No | Partial | Good for HMM, sequence classifiers |
| Directed Graph | No | Yes | No | No | Good for GNN, regime analysis |
| FSM Trace | Yes | Yes | Yes | Yes | Best overall, but high dimensionality |
| Hierarchical Tree | Partial | Yes | Yes | Partial | Good for tree-based models |
| Timeline | Yes | Yes | No | No | Visualization only |

### Model Considerations (Not Recommendations)

**Transformer:**
- Would preserve full temporal context via attention
- Could learn which transitions matter for entry quality
- Requires fixed-length input window (120s → N tokens)
- Token vocabulary would be the Level 2 composite events

**HMM (Hidden Markov Model):**
- Naturally models the state machine concept
- States are hidden, observations are primitive events
- Could learn transition probabilities from data
- Assumes memoryless transitions (Markov property) - may be too restrictive

**RNN / LSTM:**
- Processes event stream sequentially
- Maintains hidden state (analogous to FSM state)
- Variable-length input support
- May struggle with long-range dependencies

**Sequence Classifier:**
- Takes a complete story (state transition list) as input
- Classifies the story as "tradeable" or "not tradeable"
- Simplest approach, but requires labeled examples
- Could use bag-of-transitions as features

**Graph Neural Network:**
- Operates on the directed graph representation
- Could learn which state transition patterns are profitable
- Requires graph construction from temporal data
- Most complex to implement

**Something Else - Temporal Convolutional Network:**
- Operates on the event stream as a 1D signal
- Preserves local temporal patterns
- Parallelizable (unlike RNN)
- May miss long-range dependencies

### Key Insight

The FSM Trace representation is the most information-rich input for any model. The question is whether the added complexity (sub-state detail, transition triggers) provides enough signal improvement over the simpler State Transition List to justify the dimensionality.

This should be determined empirically, not theoretically.

---

## 8. Validation

### How to Prove the New Representation Is Better Than Scalar Features

### Experiment 1: Predictive Power

**Setup:**
- For each 120-second window in the dataset, compute:
  - Scalar features (CVD, slope, trade rate, etc.) - the current representation
  - Story representation (state transitions, narratives)
- For each window, label whether a tradeable setup occurs in the next 60 seconds
- Train a classifier on each representation
- Compare AUC-ROC, precision-recall, and F1

**Hypothesis:** The story representation provides higher AUC-ROC than scalar features because it captures temporal structure that scalars lose.

### Experiment 2: Entry Quality

**Setup:**
- Run the existing backtest with the current reader (scalar features)
- Run the same backtest with the story engine replacing the scalar features
- Compare: win rate, R/trade, max drawdown, trade count

**Hypothesis:** The story engine produces higher R/trade with similar or fewer trades, because it filters out noise that scalars cannot distinguish from signal.

### Experiment 3: State Duration Analysis

**Setup:**
- For each state in the story engine output, measure:
  - Duration of the state
  - Intensity of the state
  - Outcome (price movement in the direction of the state)
- Correlate state properties with trade outcomes

**Hypothesis:** Longer, higher-intensity states in the `absorbing` → `initiative` transition predict better entries than short, low-intensity states. Scalar features cannot make this distinction.

### Experiment 4: Narrative Completeness

**Setup:**
- For each entry in the backtest, check whether the story engine produced a complete narrative arc (onset → development → climax → resolution)
- Compare entry quality for complete vs. incomplete narratives

**Hypothesis:** Complete narratives have higher win rates than incomplete ones, because they represent confirmed patterns rather than premature entries.

### Experiment 5: Falsification

**Setup:**
- Run the story engine on the full dataset
- Compute mutual information between story features and outcomes
- If mutual information is not significantly higher than scalar features, the hypothesis is falsified

**Decision rule:** If Experiment 1 shows AUC-ROC improvement < 2%, abandon the story engine approach.

---

## 9. Risks

### Challenge the Hypothesis

**Assumption:** Humans recognize stories, and representing market data as stories improves trading decisions.

**What evidence would falsify this:**

1. **Scalar features perform equally well.** If CVD, slope, and trade rate capture the same information as the story representation, the added complexity is not justified. This would be shown by Experiment 1 producing equivalent AUC-ROC.

2. **Stories are overfit to historical data.** If the story engine produces good backtest results but fails in live trading, the narratives are overfit. This would be shown by poor out-of-sample performance.

3. **The vocabulary is wrong.** If the proposed event types (initiative, absorption, exhaustion, etc.) do not correlate with price movement, the vocabulary needs revision. This would be shown by Experiment 3 producing random correlations.

4. **Transitions are too noisy.** If the state machine oscillates between states too frequently (whipsaw), the transition thresholds are wrong. This would be shown by many short-duration states (<5 seconds).

5. **The market is not story-shaped.** If price movements are driven by exogenous events (news, liquidations, exchange operations) rather than endogenous order flow dynamics, stories are the wrong abstraction. This would be shown by high-frequency price jumps that do not follow narrative arcs.

### Alternative Explanations

1. **The edge is in selectivity, not representation.** The backtest results show that filtering trades by regime and trade count produces 18x better R/trade. The story engine may not improve on this; the edge may be purely in which trades to take, not in how to represent them.

2. **The edge is in the trailing stop.** Removing the trailing stop drops R/trade from ~5.4 to ~1.5. The trailing stop is doing most of the work. The story engine may not improve on this.

3. **The edge is in the data, not the model.** If 1-second orderflow data is noisy or has artifacts (exchange-reported vs. actual trades), the story engine may be building narratives on unreliable foundations.

### What Would Convince Me to Abandon This

- Experiment 1 shows AUC-ROC improvement < 2% over scalar features
- The state machine produces states with median duration < 3 seconds (too noisy)
- Live trading results diverge significantly from backtest results
- The vocabulary requires more than 20 event types to be effective (too complex)
- A simpler approach (e.g., just using state transition counts as features) performs equally well

The story engine is a hypothesis. It must prove itself against the null hypothesis: scalar features are sufficient. The experiments above are designed to test this rigorously.

---

## Summary

| Aspect | Current System | Story Engine |
|--------|---------------|--------------|
| Input | Scalar features (CVD, slope, rate) | Temporal event sequences |
| Memory | None (per-tick) | State machine with transitions |
| Abstraction | Flat | 3-level hierarchy |
| Vocabulary | ~70 events, mostly neutral | 16 events, all meaningful |
| Output | Single read with narrative string | State transition trace with narrative arc |
| ML readiness | Low (requires feature engineering) | High (structured sequence data) |

The story engine is not a replacement for the current reader. It is a new representation layer that sits between raw order flow and the entry logic. The current reader's auction analysis, volume profile structure, and regime detection remain valid. The story engine replaces the scalar orderflow features (CVD, pressure, events) with temporal sequences.
