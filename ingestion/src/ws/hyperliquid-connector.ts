import { WebSocket } from 'ws'
import type { OrderflowEvent } from '@packages/strategy-lab/read-core/orderflow/types.ts'
import { connectHyperliquidOrderflow } from '@packages/market-data/orderflow/connect-hyperliquid-orderflow.ts'
import type { TradeBuffer } from '../trade-buffer.ts'
import type { CandleAggregator } from '../candle-aggregator.ts'
import type { SSEManager } from '../sse-manager.ts'
import { NETWORK } from '../../env.ts'
import { INTERVAL_MS } from '../http/subscribe.ts'

globalThis.WebSocket = WebSocket as unknown as typeof globalThis.WebSocket

const ASSETS = ['ETH', 'BTC']
const INTERVALS: { name: string; ms: number }[] = Object.entries(INTERVAL_MS).map(([name, ms]) => ({ name, ms }))

export function connectAndStream(
  tradeBuffer: TradeBuffer,
  aggregator: CandleAggregator,
  sseManager: SSEManager,
): { close(): void } {
  const connection = connectHyperliquidOrderflow({
    network: NETWORK,
    assets: ASSETS,
    onEvent(event: OrderflowEvent) {
      if (event.type !== 'trade') return
      const { trade } = event
      const timestamp = Math.floor(trade.time / 1000)

      tradeBuffer.push({
        price: trade.price,
        size: trade.size,
        side: trade.side,
        timestamp,
      })

      for (const { name, ms } of INTERVALS) {
        const result = aggregator.applyTrade(name, ms, trade.price, trade.size, timestamp)
        if (result === 'close') {
          const closed = aggregator.getClosed()
          for (const candle of closed) {
            sseManager.broadcast(trade.asset, 'candle-close', candle)
          }
        }
      }

      sseManager.broadcast(trade.asset, 'candle-update', {
        price: trade.price,
        size: trade.size,
        side: trade.side,
        timestamp,
      })
    },
    onRecord(record) {
      // TODO: persist to DB
    },
    onStatus(status) {
      console.log(`hyperliquid ws: ${status}`)
    },
    onError(error) {
      console.error('hyperliquid ws error:', error)
    },
  })

  return {
    close() {
      connection.close()
    },
  }
}
