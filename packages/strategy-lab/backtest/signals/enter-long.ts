import type { Signal } from "@strategy-lab/types";

export function enterLong(input: Omit<Extract<Signal, { action: "enter" }>, "action" | "side">): Signal {
  return { action: "enter", side: "long", ...input };
}


