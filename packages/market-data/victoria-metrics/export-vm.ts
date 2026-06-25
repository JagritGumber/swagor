import type { VictoriaMetricsExportSeries } from "../shared/types";
import { validateVmExportSeries } from "./validate-vm-export-series";

export async function exportVm(input: {
  vmUrl: string;
  match: string;
  startMs: number;
  endMs: number;
}): Promise<VictoriaMetricsExportSeries[]> {
  const url = new URL(`${input.vmUrl.replace(/\/$/, "")}/api/v1/export`);
  const body = new URLSearchParams();
  body.set("match[]", input.match);
  body.set("start", String(input.startMs / 1000));
  body.set("end", String(input.endMs / 1000));

  const res = await fetch(url, {
    method: "POST",
    body,
  });
  if (!res.ok) throw new Error(`VictoriaMetrics export ${res.status}: ${await res.text()}`);

  const text = await res.text();
  if (text.trim().length === 0) return [];
  return text
    .trim()
    .split("\n")
    .map((line) => validateVmExportSeries(JSON.parse(line) as unknown));
}

