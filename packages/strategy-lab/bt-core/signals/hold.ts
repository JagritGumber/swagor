import type { Signal } from "../../types";

export function hold(reason: string): Signal {
  return { action: "hold", reason };
}
