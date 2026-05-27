export function crossedBelow(values: number[], level: number): boolean {
  if (values.length < 2) return false;
  return values[values.length - 2] >= level && values[values.length - 1] < level;
}
