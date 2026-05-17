/**
 * Public surface for Arc anchoring. Implementation split across:
 *   - ./sdk                  Circle SDK init + JSON-safe value type + hash helpers
 *   - ./anchor-trade         opened / closed paper-trade anchors
 *   - ./anchor-watcher       watcher-tick anchors
 *   - ./anchor-analysis      daily plan / backtest analysis anchors
 *   - ./poll-pending-anchors heartbeat poller + registry for new sources
 *   - ./broker-fees-poll     side-effect: registers broker_fees as a source
 *   - ./register-erc8004.service  per-user ERC-8004 identity mint
 *
 * Every anchor function takes a `walletId` arg: it's the user's own
 * Circle Dev Wallet from `selboInstance.circleWalletId`. Events on the
 * shared PortfolioDecisions contract carry that wallet as msg.sender,
 * so per-user track records resolve by wallet address on-chain.
 */
import "./broker-fees-poll";

export { sha256Hex, type AnchorJsonValue } from "./sdk";
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
export {
  anchorDailyAnalysis,
  fireDailyPlanAnchor,
  type DailyAnalysisAnchorInput,
  type DailyAnalysisAnchorResult,
} from "./anchor-analysis";
export { registerSelboAgentForInstance } from "./register-erc8004.service";
