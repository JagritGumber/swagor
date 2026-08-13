import { WebSocket } from 'ws'
import type { OrderflowEvent } from '@packages/strategy-lab/read-core/orderflow/types.ts'
import { connectHyperliquidOrderflow } from '@packages/market-data/orderflow/connect-hyperliquid-orderflow.ts'
import type { StoredOrderflowEvent } from '@packages/market-data/orderflow/types.ts'
import type { TradeBuffer } from '../trade-buffer.ts'
import type { CandleAggregator } from '../candle-aggregator.ts'
import type { SSEManager } from '../sse-manager.ts'
import type { DB } from '../db/index.ts'
import { trades, candles } from '../db/schema.ts'
import { NETWORK } from '@env'
import { INTERVAL_MS } from '../http/subscribe.ts'
import { publishCandleClose } from '../queue.ts'

globalThis.WebSocket = WebSocket as unknown as typeof globalThis.WebSocket

const ASSETS = ['ETH', 'BTC', 'SOL', 'XRP', 'DOGE']
const INTERVALS: { name: string; ms: number }[] = Object.entries(INTERVAL_MS).map(([name, ms]) => ({ name, ms }))

export function connectAndStream(
  tradeBuffer: TradeBuffer,
  aggregator: CandleAggregator,
  sseManager: SSEManager,
  db: DB,
): { close(): void } {
  const connection = connectHyperliquidOrderflow({
    network: NETWORK,
    assets: ASSETS,
    async onEvent(event: OrderflowEvent) {
      if (event.type !== 'trade') return
      const { trade } = event
      const timestamp = Math.floor(trade.time / 1000)

      tradeBuffer.push({
        price: trade.price,
        size: trade.size,
        side: trade.side,
        timestamp,
      })

      await db.insert(trades).values({
        asset: trade.asset,
        price: trade.price,
        size: trade.size,
        side: trade.side,
        timestamp,
      })

      let anyClosed = false
      for (const { name, ms } of INTERVALS) {
        if (aggregator.applyTrade(trade.asset, name, ms, trade.price, trade.size, timestamp) === 'close') {
          anyClosed = true
        }
      }

      if (anyClosed) {
        const closed = aggregator.getClosed()
        for (const candle of closed) {
          await db.insert(candles).values({
            t: candle.t,
            o: candle.o,
            h: candle.h,
            l: candle.l,
            c: candle.c,
            v: candle.v,
            asset: trade.asset,
            interval: candle.interval,
          })

          sseManager.broadcast(trade.asset, 'candle-close', { ...candle, t: candle.t * 1000 })
          await publishCandleClose(trade.asset, candle.interval, {
            t: candle.t * 1000,
            o: candle.o,
            h: candle.h,
            l: candle.l,
            c: candle.c,
            v: candle.v,
          })
        }
      }

      for (const { name } of INTERVALS) {
        const forming = aggregator.getForming(trade.asset, name)
        if (forming) {
          sseManager.broadcast(trade.asset, 'candle-update', { ...forming, t: forming.t * 1000 })
        }
      }
    },
    onRecord(record: StoredOrderflowEvent) {
      // TODO: persist raw records to parquet or separate table
    },
    onStatus(status: string) {
      console.log(`hyperliquid ws: ${status}`)
    },
    onError(error: unknown) {
      console.error('hyperliquid ws error:', error)
    },
  })

  return {
    close() {
      connection.close()
    },
  }
}
