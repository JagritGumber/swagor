import type { OrderflowEvent } from "@strategy-lab";
import type { HyperliquidNetwork } from "../shared/types";
import { hyperliquidOrderflowRecords } from "./hyperliquid-orderflow-records";
import { hyperliquidWsUrl } from "./hyperliquid-ws-url";
import type { StoredOrderflowEvent } from "./types";

type WebSocketLike = {
  send(data: string): void;
  close(): void;
  onopen: (() => void) | null;
  onmessage: ((event: { data: string | ArrayBuffer }) => void) | null;
  onerror: ((event: unknown) => void) | null;
  onclose: (() => void) | null;
};

type WebSocketCtor = new (url: string) => WebSocketLike;

export function connectHyperliquidOrderflow(input: {
  network: HyperliquidNetwork;
  assets: string[];
  onEvent(event: OrderflowEvent): void | Promise<void>;
  onRecord?(record: StoredOrderflowEvent): void | Promise<void>;
  onStatus?(status: string): void;
  onError?(error: unknown): void;
}): { close(): void } {
  const WebSocketImpl = globalThis.WebSocket as unknown as WebSocketCtor | undefined;
  if (!WebSocketImpl) throw new Error("WebSocket is not available in this runtime");

  const ws = new WebSocketImpl(hyperliquidWsUrl(input.network));
  ws.onopen = () => {
    input.onStatus?.("open");
    for (const asset of input.assets) {
      subscribe(ws, "trades", asset);
      subscribe(ws, "bbo", asset);
    }
  };
  ws.onmessage = (event) => {
    try {
      const text = typeof event.data === "string" ? event.data : new TextDecoder().decode(event.data);
      const parsed = JSON.parse(text) as unknown;
      const receivedAt = Date.now();
      for (const record of hyperliquidOrderflowRecords({ network: input.network, message: parsed, receivedAt })) {
        callSafely(() => input.onRecord?.(record), input.onError);
        for (const orderflowEvent of record.events) {
          callSafely(() => input.onEvent(orderflowEvent), input.onError);
        }
      }
    } catch (error: unknown) {
      input.onError?.(error);
    }
  };
  ws.onerror = (event) => input.onError?.(event);
  ws.onclose = () => input.onStatus?.("closed");

  return {
    close(): void {
      ws.close();
    },
  };
}

function callSafely(callback: () => void | Promise<void> | undefined, onError?: (error: unknown) => void): void {
  try {
    void Promise.resolve(callback()).catch((error: unknown) => onError?.(error));
  } catch (error: unknown) {
    onError?.(error);
  }
}

function subscribe(ws: WebSocketLike, type: "trades" | "bbo", asset: string): void {
  ws.send(JSON.stringify({
    method: "subscribe",
    subscription: { type, coin: asset.toUpperCase() },
  }));
}

