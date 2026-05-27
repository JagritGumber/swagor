import { Type } from "@sinclair/typebox";

export const VictoriaMetricsExportSeriesSchema = Type.Object({
  metric: Type.Record(Type.String(), Type.String()),
  values: Type.Array(Type.Number()),
  timestamps: Type.Array(Type.Number()),
}, { additionalProperties: true });
