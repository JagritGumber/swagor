import "server-only";

export type RiskSide = "long" | "short" | "unknown";

export type RiskPositionInput = {
  source: "hyperliquid" | "paper";
  asset: string;
  side?: RiskSide;
  sizeUsd: number | null;
  entryPrice: number | null;
  markPrice: number | null;
  leverage?: number | null;
  liquidationPrice?: number | null;
  marginUsedUsd?: number | null;
  unrealizedPnlUsd?: number | null;
};

export type RiskAccountInput = {
  equityUsd: number | null;
  withdrawableUsd: number | null;
};

export type PositionRisk = {
  source: RiskPositionInput["source"];
  asset: string;
  side: RiskSide;
  sizeUsd: number | null;
  leverage: number | null;
  liquidationPrice: number | null;
  liquidationDistancePct: number | null;
  pnlPct: number | null;
  severity: "normal" | "watch" | "urgent" | "critical";
  reasons: string[];
};

export type RiskSnapshot = {
  status: "normal" | "watch" | "urgent" | "critical";
  emergencyAction: "none" | "tighten_stops" | "reduce_position" | "close_position";
  summary: string;
  account: RiskAccountInput & {
    marginUsagePct: number | null;
  };
  positions: PositionRisk[];
  closestLiquidationDistancePct: number | null;
  totalExposureUsd: number;
  reasons: string[];
};

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function inferSide(input: RiskPositionInput): RiskSide {
  if (input.side) return input.side;
  if (input.sizeUsd === null) return "unknown";
  return input.sizeUsd >= 0 ? "long" : "short";
}

function liquidationDistancePct(input: RiskPositionInput): number | null {
  if (!input.markPrice || !input.liquidationPrice || input.markPrice <= 0) return null;
  return Math.abs(input.markPrice - input.liquidationPrice) / input.markPrice * 100;
}

function pnlPct(input: RiskPositionInput, side: RiskSide): number | null {
  if (!input.entryPrice || !input.markPrice || input.entryPrice <= 0) return null;
  const move =
    side === "short"
      ? (input.entryPrice - input.markPrice) / input.entryPrice
      : (input.markPrice - input.entryPrice) / input.entryPrice;
  return move * 100;
}

function rankSeverity(
  current: PositionRisk["severity"],
  next: PositionRisk["severity"],
): PositionRisk["severity"] {
  const rank = { normal: 0, watch: 1, urgent: 2, critical: 3 };
  return rank[next] > rank[current] ? next : current;
}

function summarize(status: RiskSnapshot["status"], reasons: string[]): string {
  if (status === "critical") return `Critical risk: ${reasons[0] ?? "position needs immediate protection"}`;
  if (status === "urgent") return `Urgent risk: ${reasons[0] ?? "position needs tactical action"}`;
  if (status === "watch") return `Watch risk: ${reasons[0] ?? "portfolio needs closer monitoring"}`;
  return "Risk normal: no deterministic emergency trigger found";
}

export function evaluatePerpRisk(opts: {
  account: RiskAccountInput;
  positions: RiskPositionInput[];
}): RiskSnapshot {
  const positionRisks = opts.positions.map((position): PositionRisk => {
    const side = inferSide(position);
    const distance = liquidationDistancePct(position);
    const pnl = pnlPct(position, side);
    const reasons: string[] = [];
    let severity: PositionRisk["severity"] = "normal";

    if (position.markPrice === null) {
      severity = rankSeverity(severity, "watch");
      reasons.push(`${position.asset} has no current mark price`);
    }

    if (distance !== null) {
      if (distance <= 3) {
        severity = rankSeverity(severity, "critical");
        reasons.push(`${position.asset} is ${distance.toFixed(2)}% from liquidation`);
      } else if (distance <= 7) {
        severity = rankSeverity(severity, "urgent");
        reasons.push(`${position.asset} is ${distance.toFixed(2)}% from liquidation`);
      } else if (distance <= 15) {
        severity = rankSeverity(severity, "watch");
        reasons.push(`${position.asset} liquidation buffer is only ${distance.toFixed(2)}%`);
      }
    }

    if ((position.leverage ?? 0) >= 8) {
      severity = rankSeverity(severity, "watch");
      reasons.push(`${position.asset} leverage is ${position.leverage}x`);
    }

    if (pnl !== null && pnl <= -8) {
      severity = rankSeverity(severity, pnl <= -15 ? "urgent" : "watch");
      reasons.push(`${position.asset} unrealized move is ${pnl.toFixed(2)}%`);
    }

    return {
      source: position.source,
      asset: position.asset,
      side,
      sizeUsd: position.sizeUsd,
      leverage: position.leverage ?? null,
      liquidationPrice: position.liquidationPrice ?? null,
      liquidationDistancePct: distance,
      pnlPct: pnl,
      severity,
      reasons,
    };
  });

  const totalExposureUsd = positionRisks.reduce(
    (sum, position) => sum + Math.abs(position.sizeUsd ?? 0),
    0,
  );
  const marginUsedUsd = opts.positions.reduce(
    (sum, position) => sum + Math.max(0, position.marginUsedUsd ?? 0),
    0,
  );
  const marginUsagePct =
    opts.account.equityUsd && opts.account.equityUsd > 0
      ? marginUsedUsd / opts.account.equityUsd * 100
      : null;

  const reasons = positionRisks.flatMap((position) => position.reasons);
  let status: RiskSnapshot["status"] = "normal";
  for (const position of positionRisks) {
    status = rankSeverity(status, position.severity);
  }
  if (marginUsagePct !== null) {
    if (marginUsagePct >= 80) {
      status = rankSeverity(status, "critical");
      reasons.unshift(`margin usage is ${marginUsagePct.toFixed(2)}%`);
    } else if (marginUsagePct >= 60) {
      status = rankSeverity(status, "urgent");
      reasons.unshift(`margin usage is ${marginUsagePct.toFixed(2)}%`);
    } else if (marginUsagePct >= 40) {
      status = rankSeverity(status, "watch");
      reasons.unshift(`margin usage is ${marginUsagePct.toFixed(2)}%`);
    }
  }

  const emergencyAction: RiskSnapshot["emergencyAction"] =
    status === "critical"
      ? "close_position"
      : status === "urgent"
        ? "reduce_position"
        : status === "watch"
          ? "tighten_stops"
          : "none";

  const liquidationDistances = positionRisks
    .map((position) => position.liquidationDistancePct)
    .filter((distance): distance is number => distance !== null);

  return {
    status,
    emergencyAction,
    summary: summarize(status, reasons),
    account: {
      equityUsd: opts.account.equityUsd,
      withdrawableUsd: opts.account.withdrawableUsd,
      marginUsagePct,
    },
    positions: positionRisks,
    closestLiquidationDistancePct:
      liquidationDistances.length > 0 ? Math.min(...liquidationDistances) : null,
    totalExposureUsd,
    reasons,
  };
}

export const riskNumber = toFiniteNumber;
