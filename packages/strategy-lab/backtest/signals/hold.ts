import type { Signal } from "@strategy-lab/types";

export function hold(reason: string): Signal {
  return { action: "hold", reason };
}


