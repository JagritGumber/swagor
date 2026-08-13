import { connectHyperliquidOrderflow } from '@packages/market-data'
import { createOrderflowWindow } from '@packages/strategy-lab/read-core/orderflow/create-orderflow-window'
import { updateOrderflowWindow } from '@packages/strategy-lab/read-core/orderflow/update-orderflow-window'
import { expireOrderflowWindow } from '@packages/strategy-lab/read-core/orderflow/expire-orderflow-window'
import type { OrderflowWindow } from '@packages/strategy-lab/read-core/orderflow/types'

let activeWindow: OrderflowWindow | null = null
let connection: { close(): void } | null = null
let connectedAsset: string | null = null

export function getLiveOrderflowWindow(): OrderflowWindow {
  if (!activeWindow) {
    activeWindow = createOrderflowWindow(60_000)
  }
  return activeWindow
}

export function startLiveOrderflow(asset: string, network: string): void {
  if (connectedAsset === asset.toUpperCase() && connection) return
  if (connection) {
    connection.close()
    connection = null
    connectedAsset = null
  }
  connection = connectHyperliquidOrderflow({
    network: network as 'mainnet' | 'testnet',
    assets: [asset],
    onEvent: (event) => {
      if (activeWindow) updateOrderflowWindow(activeWindow, event)
    },
    onError: (err) => console.error('[live-orderflow]', err),
    onStatus: (status) => console.log(`[live-orderflow] ${status}`),
  })
  connectedAsset = asset.toUpperCase()
}

export function stopLiveOrderflow(): void {
  if (connection) {
    connection.close()
    connection = null
    connectedAsset = null
  }
  activeWindow = null
}

export function expireLiveOrderflow(now: number): void {
  if (activeWindow) expireOrderflowWindow(activeWindow, now)
}
