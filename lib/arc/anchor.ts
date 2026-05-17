/**
 * Public surface for Arc anchoring. Implementation split across:
 *   - ./sdk                  Circle SDK init + JSON-safe value type + hash helpers
 *   - ./anchor-cycle         cycle / rebalance anchor
 *   - ./anchor-trade         opened / closed paper-trade anchors
 *   - ./anchor-watcher       watcher-tick anchors
 *   - ./poll-pending-anchors heartbeat poller + registry for new sources
 *
 * Slices 2 + 3 add daily-plan, backtest, and broker-fee sources by calling
 * registerAnchorSource(...) from their own modules; no change here required.
 */
export { sha256Hex, type AnchorJsonValue } from "./sdk";
export { anchorCycle, type AnchorResult } from "./anchor-cycle";
export {
  anchorClosedTrade,
  anchorOpenedTrade,
  type ClosedTradeAnchorInput,
  type OpenedTradeAnchorInput,
  type TradeAnchorResult,
} from "./anchor-trade";
export {
  anchorWatcherDecision,
  type WatcherAnchorInput,
  type WatcherAnchorResult,
} from "./anchor-watcher";
export { pollPendingAnchors, registerAnchorSource, type AnchorSource } from "./poll-pending-anchors";
