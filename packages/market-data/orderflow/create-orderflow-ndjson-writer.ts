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
  onError?(error: unknown): void;
}): OrderflowNdjsonWriter {
  const buffers = new Map<string, string[]>();
  const writeQueues = new Map<string, Promise<void>>();
  const flushIntervalMs = input.flushIntervalMs ?? 1000;
  const maxBufferedRecords = input.maxBufferedRecords ?? 250;
  let timer: ReturnType<typeof setInterval> | null = setInterval(() => {
    void flush().catch((error: unknown) => input.onError?.(error));
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
    if (lines.length >= maxBufferedRecords) void flushPath(path).catch((error: unknown) => input.onError?.(error));
  }

  async function flush(): Promise<void> {
    const writes: Array<Promise<void>> = [];
    for (const [path, lines] of buffers) {
      if (lines.length === 0) {
        const pending = writeQueues.get(path);
        if (pending) writes.push(pending);
        continue;
      }
      writes.push(flushPath(path));
    }
    await Promise.all(writes);
  }

  function flushPath(path: string): Promise<void> {
    const lines = buffers.get(path);
    if (!lines || lines.length === 0) return writeQueues.get(path) ?? Promise.resolve();
    const content = lines.join("");
    lines.length = 0;
    const previous = writeQueues.get(path) ?? Promise.resolve();
    const write = previous.then(async () => {
      await mkdir(dirname(path), { recursive: true });
      await appendFile(path, content, "utf8");
    });
    let tracked: Promise<void>;
    tracked = write.finally(() => {
      if (writeQueues.get(path) === tracked) writeQueues.delete(path);
    });
    writeQueues.set(path, tracked);
    return tracked;
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
