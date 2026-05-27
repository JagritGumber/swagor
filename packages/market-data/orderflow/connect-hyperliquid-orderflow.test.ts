import { describe, expect, test } from "bun:test";
import { connectHyperliquidOrderflow } from "./connect-hyperliquid-orderflow";

describe("connectHyperliquidOrderflow", () => {
  test("routes async callback rejections to onError", async () => {
    const original = globalThis.WebSocket;
    const sockets: MockWebSocket[] = [];
    globalThis.WebSocket = class extends MockWebSocket {
      constructor(url: string) {
        super(url);
        sockets.push(this);
      }
    } as unknown as typeof WebSocket;

    const errors: unknown[] = [];
    try {
      connectHyperliquidOrderflow({
        network: "mainnet",
        assets: ["BTC"],
        onEvent: async () => {
          throw new Error("event rejected");
        },
        onError: (error) => errors.push(error),
      });
      sockets[0]?.onopen?.();
      sockets[0]?.onmessage?.({
        data: JSON.stringify({
          channel: "trades",
          data: [{
            coin: "BTC",
            side: "B",
            px: "100",
            sz: "1",
            hash: "0x1",
            time: 1,
            tid: 1,
            users: ["0x1", "0x2"],
          }],
        }),
      });
      await Promise.resolve();
      await Promise.resolve();
    } finally {
      globalThis.WebSocket = original;
    }

    expect(errors).toHaveLength(1);
    expect(errors[0]).toBeInstanceOf(Error);
    expect((errors[0] as Error).message).toBe("event rejected");
  });
});

class MockWebSocket {
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string | ArrayBuffer }) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  onclose: (() => void) | null = null;

  constructor(readonly url: string) {}

  send(_data: string): void {}

  close(): void {
    this.onclose?.();
  }
}
