import { readFile } from "node:fs/promises";
import type { OrderflowEvent } from "@strategy-lab";
import { parseOrderflowEventLine } from "./parse-orderflow-event-line";

export async function readOrderflowEvents(path: string): Promise<OrderflowEvent[]> {
  const text = await readFile(path, "utf8");
  const events: OrderflowEvent[] = [];
  for (const line of text.split("\n")) {
    if (line.trim().length === 0) continue;
    events.push(...parseOrderflowEventLine(line));
  }
  return events;
}

