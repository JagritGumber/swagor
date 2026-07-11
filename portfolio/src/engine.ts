import type { Position, PortfolioConfig, PortfolioSnapshot, JudgmentAction } from "./types";
import { createPositionId } from "./position/id";
import { checkExit, computePnlPct } from "./position/exit";

export type PortfolioEngine = {
  processJudgment(action: JudgmentAction, asset: string, timestamp: number, judgmentId: string): Position | null;
  tick(asset: string, price: number): Position[];
  snapshot(): PortfolioSnapshot;
  getPositions(): Position[];
  getOpenPositions(): Position[];
  getClosedPositions(): Position[];
  hydrate(positions: Position[], equity: number): void;
};

const DEFAULT_CONFIG: PortfolioConfig = {
  initialEquity: 10_000,
  riskPerTradePct: 1,
  maxOpenPositions: 3,
};

export function createPortfolioEngine(config?: Partial<PortfolioConfig>): PortfolioEngine {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const positions: Position[] = [];
  let equity = cfg.initialEquity;

  function openPositionsFor(asset: string) {
    return positions.filter((p) => p.asset === asset && p.status === "open");
  }

  function allOpenPositions() {
    return positions.filter((p) => p.status === "open");
  }

  function computeSnapshot(): PortfolioSnapshot {
    const closed = positions.filter((p) => p.status === "closed");
    const open = allOpenPositions();
    const totalPnl = closed.reduce((sum, p) => sum + (p.pnlPct ?? 0), 0);
    const today = new Date().toDateString();
    const dailyPnl = closed
      .filter((p) => p.exitTime && new Date(p.exitTime).toDateString() === today)
      .reduce((sum, p) => sum + (p.pnlPct ?? 0), 0);

    return {
      timestamp: Date.now(),
      equity,
      positions: [...positions],
      dailyPnl,
      totalPnl,
      tradeCount: closed.length,
      winCount: closed.filter((p) => (p.pnlPct ?? 0) > 0).length,
      lossCount: closed.filter((p) => (p.pnlPct ?? 0) < 0).length,
      openPositionCount: open.length,
    };
  }

  return {
    processJudgment(action: JudgmentAction, asset: string, timestamp: number, judgmentId: string): Position | null {
      if (action.type !== "enter") return null;

      const open = allOpenPositions();
      if (open.length >= cfg.maxOpenPositions) return null;

      const assetOpen = openPositionsFor(asset);
      if (assetOpen.length > 0) return null;

      const riskAmount = equity * (cfg.riskPerTradePct / 100);
      const priceRisk = Math.abs(action.entry - action.stop);
      if (priceRisk === 0) return null;
      const size = riskAmount / (priceRisk / action.entry);

      const position: Position = {
        id: createPositionId(asset, timestamp),
        asset,
        side: action.side,
        entryPrice: action.entry,
        entryTime: timestamp,
        size,
        stop: action.stop,
        target: action.target,
        status: "open",
        judgmentId,
      };

      positions.push(position);
      return position;
    },

    tick(asset: string, price: number): Position[] {
      const closed: Position[] = [];
      const open = openPositionsFor(asset);

      for (const position of open) {
        const exit = checkExit(position, price);
        if (exit.shouldExit) {
          position.status = "closed";
          position.exitPrice = exit.exitPrice;
          position.exitTime = Date.now();
          position.exitReason = exit.reason;
          position.pnlPct = computePnlPct(position.side, position.entryPrice, exit.exitPrice);
          equity += equity * (position.pnlPct / 100) * (cfg.riskPerTradePct / 100);
          closed.push(position);
        }
      }

      return closed;
    },

    snapshot: computeSnapshot,
    getPositions: () => [...positions],
    getOpenPositions: () => allOpenPositions(),
    getClosedPositions: () => positions.filter((p) => p.status === "closed"),

    hydrate(loadedPositions: Position[], loadedEquity: number) {
      positions.length = 0;
      for (const pos of loadedPositions) {
        positions.push(pos);
      }
      equity = loadedEquity;
    },
  };
}
