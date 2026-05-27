export async function writeVmLines(input: {
  vmUrl: string;
  lines: string;
}): Promise<void> {
  if (input.lines.trim().length === 0) return;
  const res = await fetch(`${input.vmUrl.replace(/\/$/, "")}/api/v1/import/prometheus`, {
    method: "POST",
    headers: { "Content-Type": "text/plain; charset=utf-8" },
    body: input.lines,
  });
  if (!res.ok) throw new Error(`VictoriaMetrics import ${res.status}: ${await res.text()}`);
}
