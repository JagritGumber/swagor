import { describe, expect, test } from "bun:test";
import { createMemoryStore } from "./create-memory-store";
import type { MemoryEvent } from "./types";

describe("createMemoryStore", () => {
  test("sets and gets an entry by key", () => {
    const memory = createMemoryStore<{ status: string }>();

    const event = memory.set("btc", { status: "watching" }, { now: 10 });
    const entry = memory.get("btc");

    expect(event.type).toBe("memory-set");
    expect(entry?.value.status).toBe("watching");
    expect(entry?.createdAt).toBe(10);
    expect(entry?.updatedAt).toBe(10);
    expect(entry?.version).toBe(1);
  });

  test("updates preserve createdAt and increment version", () => {
    const memory = createMemoryStore<number>();

    memory.set("counter", 1, { now: 10 });
    const event = memory.update("counter", (current) => (current?.value ?? 0) + 1, { now: 20 });
    const entry = memory.get("counter");

    expect(event.type).toBe("memory-updated");
    expect(entry?.value).toBe(2);
    expect(entry?.createdAt).toBe(10);
    expect(entry?.updatedAt).toBe(20);
    expect(entry?.version).toBe(2);
  });

  test("deleting removes entry and emits event", () => {
    const events: Array<MemoryEvent<string>> = [];
    const memory = createMemoryStore<string>({ onEvent: (event) => events.push(event) });

    memory.set("setup", "active", { now: 10 });
    const event = memory.delete("setup", "invalidated", 20);

    expect(event?.type).toBe("memory-deleted");
    expect(event?.reason).toBe("invalidated");
    expect(memory.get("setup")).toBeNull();
    expect(events.map((item) => item.type)).toEqual(["memory-set", "memory-deleted"]);
  });

  test("expire removes only expired entries", () => {
    const memory = createMemoryStore<string>({ ttlMs: 100 });

    memory.set("old", "expired", { now: 0 });
    memory.set("fresh", "alive", { now: 80 });
    const events = memory.expire(101);

    expect(events).toHaveLength(1);
    expect(events[0]?.type).toBe("memory-expired");
    expect(events[0]?.key).toBe("old");
    expect(memory.get("old")).toBeNull();
    expect(memory.get("fresh")?.value).toBe("alive");
  });

  test("explicit null ttl disables expiry for an entry", () => {
    const memory = createMemoryStore<string>({ ttlMs: 100 });

    memory.set("persistent", "alive", { now: 0, ttlMs: null });
    const events = memory.expire(1_000);

    expect(events).toHaveLength(0);
    expect(memory.get("persistent")?.value).toBe("alive");
  });

  test("updates refresh default ttl by default", () => {
    const memory = createMemoryStore<string>({ ttlMs: 100 });

    memory.set("setup", "waiting", { now: 0 });
    memory.update("setup", () => "still waiting", { now: 80 });
    const events = memory.expire(101);

    expect(events).toHaveLength(0);
    expect(memory.get("setup")?.expiresAt).toBe(180);
  });

  test("event callback errors are reported without failing the write", () => {
    const errors: unknown[] = [];
    const memory = createMemoryStore<string>({
      onEvent: () => {
        throw new Error("event failed");
      },
      onEventError: (error) => errors.push(error),
    });

    const event = memory.set("setup", "active", { now: 1 });

    expect(event.type).toBe("memory-set");
    expect(memory.get("setup")?.value).toBe("active");
    expect(errors).toHaveLength(1);
    expect(errors[0]).toBeInstanceOf(Error);
  });

  test("snapshot returns a new array without exposing internal map", () => {
    const memory = createMemoryStore<string>();

    memory.set("a", "one", { now: 1 });
    const snapshot = memory.snapshot();
    snapshot.length = 0;

    expect(memory.size()).toBe(1);
    expect(memory.get("a")?.value).toBe("one");
  });
});

