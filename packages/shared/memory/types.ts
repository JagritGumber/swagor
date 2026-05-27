export type MemoryEventType =
  | "memory-set"
  | "memory-updated"
  | "memory-deleted"
  | "memory-expired";

export type MemoryEntry<T> = {
  key: string;
  value: T;
  createdAt: number;
  updatedAt: number;
  expiresAt: number | null;
  version: number;
};

export type MemoryEvent<T> = {
  type: MemoryEventType;
  key: string;
  entry: MemoryEntry<T> | null;
  previous: MemoryEntry<T> | null;
  reason: string | null;
  at: number;
};

export type MemoryConfig<T> = {
  now?: () => number;
  ttlMs?: number;
  onEvent?: (event: MemoryEvent<T>) => void;
  onEventError?: (error: unknown, event: MemoryEvent<T>) => void;
};

export type MemorySetMetadata = {
  now?: number;
  ttlMs?: number | null;
  reason?: string;
};

export type MemoryStore<T> = {
  /**
   * Returns the stored entry reference. Values are not cloned or frozen for speed;
   * callers must treat entry values as immutable and use update() for changes.
   */
  get(key: string): MemoryEntry<T> | null;
  set(key: string, value: T, metadata?: MemorySetMetadata): MemoryEvent<T>;
  update(key: string, updater: (current: MemoryEntry<T> | null) => T, metadata?: MemorySetMetadata): MemoryEvent<T>;
  delete(key: string, reason?: string, now?: number): MemoryEvent<T> | null;
  expire(now?: number): Array<MemoryEvent<T>>;
  /**
   * Returns a new array of stored entry references. Entries and values are not
   * cloned or frozen for speed.
   */
  snapshot(): Array<MemoryEntry<T>>;
  size(): number;
};
