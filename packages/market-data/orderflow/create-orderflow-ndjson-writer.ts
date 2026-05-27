import { mkdir, appendFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { HyperliquidNetwork } from "../shared/types";
import { orderflowFilePath } from "./orderflow-file-path";
import type { StoredOrderflowEvent } from "./types";

export type OrderflowNdjsonWriter = {
  append(record: StoredOrderflowEvent): void;
  flush(): Promise<void>;
  close(): Promise<void>;
};

export function createOrderflowNdjsonWriter(input: {
  rootDir: string;
  network: HyperliquidNetwork;
  flushIntervalMs?: number;
  maxBufferedRecords?: number;
}): OrderflowNdjsonWriter {
  const buffers = new Map<string, string[]>();
  const flushIntervalMs = input.flushIntervalMs ?? 1000;
  const maxBufferedRecords = input.maxBufferedRecords ?? 250;
  let timer: ReturnType<typeof setInterval> | null = setInterval(() => {
    void flush();
  }, flushIntervalMs);

  function append(record: StoredOrderflowEvent): void {
    const path = orderflowFilePath({
      rootDir: input.rootDir,
      network: input.network,
      asset: record.asset,
      time: record.receivedAt,
    });
    const lines = buffers.get(path) ?? [];
    lines.push(`${JSON.stringify(record)}\n`);
    buffers.set(path, lines);
    if (lines.length >= maxBufferedRecords) void flushPath(path, lines);
  }

  async function flush(): Promise<void> {
    const writes: Array<Promise<void>> = [];
    for (const [path, lines] of buffers) {
      if (lines.length === 0) continue;
      writes.push(flushPath(path, lines));
    }
    await Promise.all(writes);
  }

  async function flushPath(path: string, lines: string[]): Promise<void> {
    if (lines.length === 0) return;
    const content = lines.join("");
    lines.length = 0;
    await mkdir(dirname(path), { recursive: true });
    await appendFile(path, content, "utf8");
  }

  async function close(): Promise<void> {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
    await flush();
  }

  return { append, flush, close };
}
