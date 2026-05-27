import type { MemoryConfig, MemoryEntry, MemoryEvent, MemorySetMetadata, MemoryStore } from "./types";

export function createMemoryStore<T>(config: MemoryConfig<T> = {}): MemoryStore<T> {
  const entries = new Map<string, MemoryEntry<T>>();
  const nowFn = config.now ?? Date.now;

  function get(key: string): MemoryEntry<T> | null {
    return entries.get(key) ?? null;
  }

  function set(key: string, value: T, metadata: MemorySetMetadata = {}): MemoryEvent<T> {
    const at = metadata.now ?? nowFn();
    const previous = entries.get(key) ?? null;
    const entry: MemoryEntry<T> = {
      key,
      value,
      createdAt: previous?.createdAt ?? at,
      updatedAt: at,
      expiresAt: expiresAt(at, metadata, config.ttlMs),
      version: previous ? previous.version + 1 : 1,
    };
    entries.set(key, entry);
    return emit({
      type: previous ? "memory-updated" : "memory-set",
      key,
      entry,
      previous,
      reason: metadata.reason ?? null,
      at,
    });
  }

  function update(
    key: string,
    updater: (current: MemoryEntry<T> | null) => T,
    metadata: MemorySetMetadata = {},
  ): MemoryEvent<T> {
    return set(key, updater(get(key)), metadata);
  }

  function deleteEntry(key: string, reason: string | null = null, now?: number): MemoryEvent<T> | null {
    const previous = entries.get(key) ?? null;
    if (!previous) return null;
    entries.delete(key);
    return emit({
      type: "memory-deleted",
      key,
      entry: null,
      previous,
      reason,
      at: now ?? nowFn(),
    });
  }

  function expire(now = nowFn()): Array<MemoryEvent<T>> {
    const events: Array<MemoryEvent<T>> = [];
    for (const entry of entries.values()) {
      if (entry.expiresAt === null || entry.expiresAt > now) continue;
      entries.delete(entry.key);
      events.push(emit({
        type: "memory-expired",
        key: entry.key,
        entry: null,
        previous: entry,
        reason: "expired",
        at: now,
      }));
    }
    return events;
  }

  function snapshot(): Array<MemoryEntry<T>> {
    return Array.from(entries.values());
  }

  function size(): number {
    return entries.size;
  }

  function emit(event: MemoryEvent<T>): MemoryEvent<T> {
    try {
      config.onEvent?.(event);
    } catch (error: unknown) {
      config.onEventError?.(error, event);
    }
    return event;
  }

  return {
    get,
    set,
    update,
    delete: deleteEntry,
    expire,
    snapshot,
    size,
  };
}

function expiresAt(now: number, metadata: MemorySetMetadata, defaultTtlMs?: number): number | null {
  if (metadata.ttlMs === null) return null;
  const ttlMs = metadata.ttlMs ?? defaultTtlMs;
  return ttlMs === undefined ? null : now + ttlMs;
}
