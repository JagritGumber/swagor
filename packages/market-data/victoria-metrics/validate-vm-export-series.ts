import { createValidator } from "@packages/shared";
import type { VictoriaMetricsExportSeries } from "../shared/types";
import { VictoriaMetricsExportSeriesSchema } from "./victoria-metrics-export-series-schema";

const validator = createValidator(VictoriaMetricsExportSeriesSchema, "VictoriaMetrics export series");

export function validateVmExportSeries(value: unknown): VictoriaMetricsExportSeries {
  const series = validator.parse(value);
  if (series.values.length !== series.timestamps.length) {
    throw new Error(`VictoriaMetrics export series validation failed: values/timestamps length mismatch`);
  }
  return series;
}

