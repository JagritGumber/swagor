# Selbo Changelog

Per-PR log of what shipped, in reverse chronological order. Paste into the Canteen / Agora submission CLI as evidence of growth, or just keep for your own record.

Hackathon window: 2026-05-11 to 2026-05-25. RFB 01 (Perpetual Futures Trading Agent).

## 2026-05-16

### PR #30 - `feat(selbo-account): fold risk fields into the card, drop RiskPanel`

Selbo's account is now a single self-contained tile. Header matches the Market h2 style. Four risk fields (Risk / Liq buffer / Margin / Exposure) live below the histogram. Separate `RiskPanel` deleted. Top row goes from `[4][6][2]` to `[4][8]` so the price chart gets its preferred width back.

## 2026-05-15

### PR #29 - `fix(selbo-account): poll equity every 60s with visibility pause`

Equity number + histogram refresh on a 60s timer; pauses when tab is hidden; refetches immediately on visibilitychange. Same pattern as activity tape and watcher poll.

### PR #28 - `feat(dashboard): Selbo's account + Risk side panel, hide unworking surfaces`

First layout pass per direct user feedback. Top row: Selbo's account (4) + Market chart (6) + Risk side panel (2). Selbo's account combines equity + thin histogram in one card. Dummy data fallback for both new tiles so the shape is visible immediately. Hid Activity tape, BalanceRisk, EquityCurve (folded in), TradeHistory, ArcAnchors, LifetimeStats, MarketState, PipelineNow, Decisions, Dev controls. Kept Strategy chat, Positions, Memory.

### PR #27 - `fix(db): add missing tables to drizzle tablesFilter`

Four shipped Drizzle schemas (llm_calls, equity_snapshots, strategy_revisions, tick_stages) were never added to `drizzle.config.ts::tablesFilter`. drizzle-kit's introspection skipped them; push planned `CREATE TABLE` on existing tables and the transaction threw. Fixed by adding the four names to the filter. Memory saved for future schema additions.

### PR #26 - `Add risk-gated watcher pipeline` (codex)

Bundles M7 + M11 + M12 + M13 from the dense-otter plan:
- M13: recent OHLCV candles + open-interest deltas in the watcher and fast-trader payloads. Prompt revision lets Selbo reason directly about candle patterns.
- M11: deterministic pre-trade safety rails. RSI overbought/oversold blocks and volume-price-action contradiction blocks. Block reasons surface in the decision drawer + activity tape.
- M12: realized-volatility-aware cadence blend. High RV clamps max cadence; low RV floors it.
- M7: tick_stages table + writer threaded through watcher and fast-trader + `/api/tick/current` + pipeline-now bento card.

### PR #25 - `docs: submission rehearsal script (T-2 deliverable)`

`SUBMISSION.md` with the pre-flight checklist, 14-step smoke-test golden path, 90-second demo script with timed talking points, submission artifacts checklist, known limitations, day-of guardrails, post-submission steps.

### PR #24 - `feat: /metrics admin page (RFB 01 traction)`

Admin-gated `/metrics` server-rendered page. Ten tiles aggregated from existing tables: active Selbos, watcher ticks/24h, risk emergencies/24h, trades opened/closed, paper volume/24h, realized PnL lifetime, win rate, LLM calls/24h, LLM tokens/24h. No schema change.

### PR #23 - `docs: rewrite README around current Selbo + RFB 01 framing`

README leads with the user-visible value (bento layout, decision drawer, memory CRUD, strategy chat, equity curve) instead of architecture. Dropped Cloudflare/wrangler/OpenNext references. Dropped obsolete M1 schema note. Updated project layout for current schema files and bento components. Paper-mode disclaimer pointer at top.

### PR #22 - `feat(strategy): multi-turn chat with revision history (Spine 8)`

`strategy_revisions` table + CHECK constraint + index. `GET /api/strategy/chat` and `POST /api/strategy/chat` (transactional user-insert + cache update; LLM paraphrase outside transaction). New `StrategyChat` client component replaces `StrategyBriefCard`. Esc-to-close, autofocus textarea, focus trap with close-X fallback when textarea disabled.

### PR #21 - `feat(memory): user CRUD with thumbs up/down + delete (Spine 6)`

`memory_entries` gains `user_feedback` (good|bad enum, CHECK-constrained) + `deleted_at` + partial index. `getRecentLessons` filters bad-rated and soft-deleted entries. CRUD endpoints (`GET /api/memory`, `PATCH/DELETE /api/memory/[id]`). New `MemoryCards` UI with thumbs up/down + delete. Two-click confirm with 200ms cooldown + setTimeout cleanup.

### PR #20 - `feat(dashboard): price chart trade markers + click-to-drawer (Spine 3)`

`/api/chart-data` returns `tradeId` + `pnlUsd` per marker + `otherAssets` list. MarketChart colors exits by pnl tone, uses circle for exits and arrow for entries. Click locates nearest marker within one bar interval and opens the decision drawer. `+N on ETH, SOL` badge near asset selector. Chart instance reuse refactor (created once on mount, series swapped on chartType change, markers updated via setMarkers).

### PR #19 - `feat: decision drawer + legal/ToS gate (Spine 2B)`

Replaced `TradeReasoningPanel` with `TradeDecisionDrawer`. Added two sections: "Market context at decision time" (RSI, EMA, ATR, regime, bias per coin) and "Risk read at decision time" (status, exposure, closest liq, summary). Built `/legal/disclaimer` page, footer link, `selbo_instances.tos_accepted_at` column, server-side ToS gate that early-returns before any data fetch.

### PR #18 - `feat(dashboard): equity snapshots + balance card + equity curve (Spine 2A)`

New `equity_snapshots` table + writer in watcher (fire-and-forget). `GET /api/equity/recent` with 5000-row LIMIT. `BalanceRisk` compact tile replaces and deletes `RiskStatusCard`. `EquityCurve` lightweight-charts area chart with 1D/7D/30D range and chart-instance reuse.

### PR #17 - `feat(dashboard): bento layout (Spine 1 of dense-otter)`

Replace vertical stack with 12-col bento grid. `DisclosureCard` widget. WatchingStrip removed. Container widens to max-w-7xl. Top viewport rows: ActivityTape + RiskStatus, MarketChart + MarketState, Strategy + Positions.

### PR #16 - `Market Features V1: deterministic indicators for Selbo` (codex)

`lib/market-features.ts` with RSI / EMA / ATR / realized volatility / regime / candidate bias / cadence hint. `MarketStateCard` surfaces it. Wired into watcher, fast-trader, and swarm context payloads.

### PR #15 - `feat(dashboard): live activity tape`

Unified chronological stream of watcher ticks + trade opens + trade closes. `GET /api/activity/recent` merges monitor_ticks and trades. `useActivityPoll` aligned to next watcher tick. Relative timestamps tick every second; pulsing dot at the imminent-fetch boundary.

### PR #14 - `feat(admin): universal LLM call logging + raw prompt/response viewer`

New `llm_calls` table. Watcher and Fast Trader call `logLlmCall` after every LLM invocation; failures swallowed. Admin-gated `GET /api/admin/llm-calls`. `LlmCallsList` component in TickDetailPanel and TradeReasoningPanel admin debug sections. Raw prompts admin-only.

### PR #13 - `feat(dashboard): admin-only Debug section on tick + trade panels`

`isAdmin()` helper + DebugJSON collapsible viewer. Admin sees raw JSON for ticks and trades.

### PR #12 - `feat(dashboard): inline detail panels (no popups) + dev turbopack`

Modal popups replaced with inline expand-from-row panels. Dev server switched to Turbopack.

### PR #11 - `feat(trades): click-to-expand reasoning modal on trade history rows`

Click any trade row to see why it opened and closed.

### PR #10 - `feat(profile): move settings off dashboard into /dashboard/profile`

Profile consolidation.

### PR #9 - `feat(dashboard): understanding layer (strategy + tick modal sections)`

Strategy brief card + tick detail modal with "Selbo saw / Selbo did" sections.

### PR #8 - `feat(dashboard): risk-first hero + click-to-expand watcher reasoning`

Risk status card hero. Watcher rationale visible per tick.

### PR #7 - `feat(auth): require external-wallet verification on signup`

SIWE-style external wallet signature gate. Sybil resistance.

### PR #6 - `chore(infra): migrate from Cloudflare Workers to Vercel`

Vercel deploy target. OpenNext-Cloudflare dropped.

### PR #5 - `M5: Arc visibility - anchor more decisions, surface them in UI`

Watcher `execute` and `risk_emergency` verdicts now Arc-anchored. Anchors surfaced in the UI.

## 2026-05-14

### PR #4 - `chore(tiers): tighten free-tier watcher cadence to 2-10 min`

Free tier sees ticks every 2-10 min. Paid tiers stay 30s-10min.

### PR #3 - `perf(hero): defer paper-shaders chunk to dynamic import`

Hero shader deferred so first paint is faster.

### PR #2 - `M4: swap swarm to 16 perp-native personas; drop yield-era decider`

Persona roster replaced from yield-era to perp-native (liquidation officer, funding arb, volatility regime analyst, market microstructure, macro analyst, trend / mean-reversion, execution / slippage, basis, adversarial critic, capital-preservation, tax/compliance India-aware, OI watcher, news-shock, correlation, regime paranoid).

### PR #1 - `M0: stabilize, swap to tsgo, rename Solon to Selbo, RFB 01 framing`

Project rename Solon -> Selbo. tsgo typecheck adopted. README + marketing copy rewritten around RFB 01. Stabilization migrations.

---

## Phase totals

- 30 PRs merged through 2026-05-16.
- Major surfaces shipped: bento dashboard, decision drawer, equity card with histogram + risk fields, price chart with trade markers, strategy chat with revision history, memory CRUD with thumbs, LLM audit log, /metrics admin, /legal/disclaimer + ToS gate, deterministic safety rails (RSI / VPA), realized-vol-aware cadence, candle-aware agent payload, tick-stage pipeline, Arc anchor coverage of execute + risk_emergency.
- T-9 days to submission (deadline 2026-05-25).
