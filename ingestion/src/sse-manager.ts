export interface SSEClient {
  send(event: string, data: unknown): void
  close(): void
}

export interface SSEManager {
  subscribe(client: SSEClient, ...assets: string[]): void
  unsubscribe(client: SSEClient): void
  broadcast(asset: string, event: string, data: unknown): void
}

export function createSSEManager(): SSEManager {
  const byAsset = new Map<string, Set<SSEClient>>()

  function subscribe(client: SSEClient, ...assets: string[]) {
    for (const asset of assets) {
      if (!byAsset.has(asset)) byAsset.set(asset, new Set())
      byAsset.get(asset)!.add(client)
    }
  }

  function unsubscribe(client: SSEClient) {
    for (const set of byAsset.values()) set.delete(client)
  }

  function broadcast(asset: string, event: string, data: unknown) {
    const clients = byAsset.get(asset)
    if (!clients) return
    for (const client of clients) client.send(event, data)
  }

  return { subscribe, unsubscribe, broadcast }
}
