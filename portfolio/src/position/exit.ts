import type { Position } from "../types";

export type ExitCheck = {
  shouldExit: boolean;
  reason?: "stop" | "target";
  exitPrice: number;
};

export function checkExit(position: Position, currentPrice: number): ExitCheck {
  if (position.side === "long") {
    if (currentPrice <= position.stop) {
      return { shouldExit: true, reason: "stop", exitPrice: position.stop };
    }
    if (currentPrice >= position.target) {
      return { shouldExit: true, reason: "target", exitPrice: position.target };
    }
  } else {
    if (currentPrice >= position.stop) {
      return { shouldExit: true, reason: "stop", exitPrice: position.stop };
    }
    if (currentPrice <= position.target) {
      return { shouldExit: true, reason: "target", exitPrice: position.target };
    }
  }
  return { shouldExit: false, exitPrice: currentPrice };
}

export function computePnlPct(side: "long" | "short", entry: number, exit: number): number {
  if (side === "long") {
    return ((exit - entry) / entry) * 100;
  }
  return ((entry - exit) / entry) * 100;
}
