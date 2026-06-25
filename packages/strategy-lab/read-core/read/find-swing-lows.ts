import type { Candle } from "../../types";

export function findSwingLows(input: {
  candles: Candle[];
  left: number;
  right: number;
}): Array<{ price: number; time: number; index: number }> {
  const swings: Array<{ price: number; time: number; index: number }> = [];
  for (let i = input.left; i < input.candles.length - input.right; i++) {
    const low = input.candles[i].l;
    let isSwing = true;
    for (let j = i - input.left; j <= i + input.right; j++) {
      if (j !== i && input.candles[j].l <= low) {
        isSwing = false;
        break;
      }
    }
    if (isSwing) swings.push({ price: low, time: input.candles[i].t, index: i });
  }
  return swings;
}

