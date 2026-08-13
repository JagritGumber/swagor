import { createValidator } from "@packages/shared";
import type { OrderflowEvent } from "@strategy-lab";
import type { StoredOrderflowEvent } from "./types";
import { OrderflowEventSchema, StoredOrderflowEventSchema } from "./orderflow-event-schema";

const orderflowEventValidator = createValidator(OrderflowEventSchema, "Orderflow event line");
const storedOrderflowEventValidator = createValidator(StoredOrderflowEventSchema, "Stored orderflow event line");

export function parseOrderflowEventLine(line: string): OrderflowEvent[] {
  const parsed = JSON.parse(line) as unknown;
  if (storedOrderflowEventValidator.check(parsed)) {
    return (parsed as StoredOrderflowEvent).events;
  }
  return [orderflowEventValidator.parse(parsed) as OrderflowEvent];
}

