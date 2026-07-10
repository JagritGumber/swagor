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

let manager: SSEManager | null = null

export function getSSEManager(): SSEManager {
  if (!manager) manager = createSSEManager()
  return manager
}
