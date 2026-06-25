export function readerSetupKeyFor(input: { asset: string; interval: string; scope?: string | null }): string {
  const parts = [
    input.scope?.trim().toUpperCase(),
    input.asset.trim().toUpperCase(),
    input.interval.trim(),
  ].filter(Boolean);
  return parts.join("|");
}


