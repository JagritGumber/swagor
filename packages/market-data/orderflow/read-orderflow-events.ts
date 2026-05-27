import { readFile } from "node:fs/promises";
import type { OrderflowEvent } from "../../strategy-lab";
import type { StoredOrderflowEvent } from "./types";

export async function readOrderflowEvents(path: string): Promise<OrderflowEvent[]> {
  const text = await readFile(path, "utf8");
  const events: OrderflowEvent[] = [];
  for (const line of text.split("\n")) {
    if (line.trim().length === 0) continue;
    const parsed = JSON.parse(line) as OrderflowEvent | StoredOrderflowEvent;
    if (isStoredOrderflowEvent(parsed)) events.push(...parsed.events);
    else events.push(parsed);
  }
  return events;
}

function isStoredOrderflowEvent(value: OrderflowEvent | StoredOrderflowEvent): value is StoredOrderflowEvent {
  return "venue" in value && "events" in value;
}
