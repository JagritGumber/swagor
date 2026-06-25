import { access } from "node:fs/promises";
import { orderflowFilePath, readOrderflowEvents } from "../../market-data";
import { orderflowFileTimesFor } from "./orderflow-file-times-for";
import type { ReaderReplayReportInput } from "./types";
import type { OrderflowEvent } from "../read-core/orderflow/types";

export async function readReportOrderflowEvents(input: ReaderReplayReportInput): Promise<{
  events: OrderflowEvent[];
  missingFiles: string[];
}> {
  const events: OrderflowEvent[] = [];
  const missingFiles: string[] = [];

  for (const time of orderflowFileTimesFor({ startMs: input.startMs, endMs: input.endMs })) {
    const path = orderflowFilePath({
      rootDir: input.orderflowRootDir,
      network: input.network,
      asset: input.asset,
      time,
    });

    if (!(await fileExists(path))) {
      missingFiles.push(path);
      continue;
    }

    const fileEvents = await readOrderflowEvents(path);
    for (const event of fileEvents) {
      if (eventAsset(event) !== input.asset.toUpperCase()) continue;
      const time = eventTime(event);
      if (time < input.startMs || time > input.endMs) continue;
      events.push(event);
    }
  }

  events.sort((a, b) => eventTime(a) - eventTime(b));
  return { events, missingFiles };
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function eventAsset(event: OrderflowEvent): string {
  return event.type === "trade" ? event.trade.asset : event.bbo.asset;
}

function eventTime(event: OrderflowEvent): number {
  return event.type === "trade" ? event.trade.time : event.bbo.time;
}
