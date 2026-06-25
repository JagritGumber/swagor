export function sma(values: number[], length: number): number | null {
  if (length <= 0 || values.length < length) return null;
  let sum = 0;
  for (let i = values.length - length; i < values.length; i++) {
    sum += values[i];
  }
  return sum / length;
}

