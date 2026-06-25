export function maxDrawdown(curve: number[]): number {
  let peak = 0;
  let worst = 0;
  for (const value of curve) {
    peak = Math.max(peak, value);
    worst = Math.min(worst, value - peak);
  }
  return worst;
}
