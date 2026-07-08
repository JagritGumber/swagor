let counter = 0;

export function createPositionId(asset: string, timestamp: number): string {
  counter++;
  const ts = timestamp.toString(36);
  const seq = counter.toString(36);
  return `p-${asset.toLowerCase()}-${ts}-${seq}`;
}
