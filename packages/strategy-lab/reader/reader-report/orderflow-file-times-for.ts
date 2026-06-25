export function orderflowFileTimesFor(input: { startMs: number; endMs: number }): number[] {
  if (!Number.isFinite(input.startMs) || !Number.isFinite(input.endMs)) {
    throw new Error("reader report needs finite startMs and endMs");
  }
  if (input.endMs < input.startMs) {
    throw new Error(`reader report endMs must be >= startMs, got ${input.endMs} < ${input.startMs}`);
  }

  const firstDay = utcDayStart(input.startMs);
  const lastDay = utcDayStart(input.endMs);
  const times: number[] = [];
  for (let time = firstDay; time <= lastDay; time += 86_400_000) {
    times.push(time);
  }
  return times;
}

function utcDayStart(time: number): number {
  const date = new Date(time);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}



