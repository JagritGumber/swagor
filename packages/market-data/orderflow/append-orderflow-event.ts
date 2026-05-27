import { mkdir, appendFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { HyperliquidNetwork } from "../shared/types";
import { orderflowFilePath } from "./orderflow-file-path";
import type { StoredOrderflowEvent } from "./types";

export async function appendOrderflowEvent(input: {
  rootDir: string;
  network: HyperliquidNetwork;
  record: StoredOrderflowEvent;
}): Promise<void> {
  const path = orderflowFilePath({
    rootDir: input.rootDir,
    network: input.network,
    asset: input.record.asset,
    time: input.record.receivedAt,
  });
  await mkdir(dirname(path), { recursive: true });
  await appendFile(path, `${JSON.stringify(input.record)}\n`, "utf8");
}
