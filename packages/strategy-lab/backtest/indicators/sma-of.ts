export function smaOf(values: number[]): number | null {
  if (values.length === 0) return null;
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
  }
  return sum / values.length;
}


