import type { Candle } from "../../types";

export function findSwingHighs(input: {
  candles: Candle[];
  left: number;
  right: number;
}): Array<{ price: number; time: number; index: number }> {
  const swings: Array<{ price: number; time: number; index: number }> = [];
  for (let i = input.left; i < input.candles.length - input.right; i++) {
    const high = input.candles[i].h;
    let isSwing = true;
    for (let j = i - input.left; j <= i + input.right; j++) {
      if (j !== i && input.candles[j].h >= high) {
        isSwing = false;
        break;
      }
    }
    if (isSwing) swings.push({ price: high, time: input.candles[i].t, index: i });
  }
  return swings;
}
