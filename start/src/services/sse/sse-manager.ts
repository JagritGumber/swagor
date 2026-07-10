export interface SSEClient {
  send(event: string, data: unknown): void
  close(): void
}

export interface SSEManager {
  subscribe(client: SSEClient, asset: string): void
  unsubscribe(client: SSEClient): void
  broadcast(asset: string, event: string, data: unknown): void
  getSubscriberCount(asset: string): number
}

export function createSSEManager(): SSEManager {
  const byAsset = new Map<string, Set<SSEClient>>()

  function subscribe(client: SSEClient, asset: string) {
    if (!byAsset.has(asset)) byAsset.set(asset, new Set())
    byAsset.get(asset)!.add(client)
  }

  function unsubscribe(client: SSEClient) {
    for (const set of byAsset.values()) set.delete(client)
  }

  function broadcast(asset: string, event: string, data: unknown) {
    const clients = byAsset.get(asset)
    if (!clients) return
    for (const client of clients) {
      try {
        client.send(event, data)
      } catch {
        clients.delete(client)
      }
    }
  }

  function getSubscriberCount(asset: string): number {
    return byAsset.get(asset)?.size ?? 0
  }

  return { subscribe, unsubscribe, broadcast, getSubscriberCount }
}

// globalThis so production server.ts (source queue-worker) and the built
// dist/server handler share one in-process SSE manager.
const GLOBAL_KEY = '__selboSseManager' as const

type GlobalSse = typeof globalThis & { [GLOBAL_KEY]?: SSEManager }

export function getSSEManager(): SSEManager {
  const g = globalThis as GlobalSse
  if (!g[GLOBAL_KEY]) {
    g[GLOBAL_KEY] = createSSEManager()
  }
  return g[GLOBAL_KEY]
}
