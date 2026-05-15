import "server-only";

import { db } from "@/lib/db/client";
import { tickStages, type NewTickStage } from "@/lib/db/schema";

export type TickStageStatus = "completed" | "pending" | "failed" | "skipped";

export type TickStageInput = {
  selboInstanceId: string;
  tickId: string;
  stage: string;
  status: TickStageStatus;
  summary: string;
  metadata?: NewTickStage["metadata"];
};

export async function recordTickStages(stages: TickStageInput[]): Promise<void> {
  if (stages.length === 0) return;
  await db.insert(tickStages).values(stages);
}
