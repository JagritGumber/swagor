import { createServer } from 'node:http'
import { PORT } from '../env.ts'
import { createSSEManager } from './sse-manager.ts'
import { createTradeBuffer } from './trade-buffer.ts'
import { createCandleAggregator } from './candle-aggregator.ts'
import { handleSubscribe } from './http/subscribe.ts'
import { setCorsHeaders } from './http/cors.ts'
import { connectAndStream } from './ws/hyperliquid-connector.ts'
import { getDb } from './db/index.ts'

const sseManager = createSSEManager()
const tradeBuffer = createTradeBuffer(1000)
const aggregator = createCandleAggregator()

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`)
  setCorsHeaders(res)

  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  if (url.pathname === '/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ status: 'ok' }))
    return
  }

  if (url.pathname === '/subscribe' && req.method === 'GET') {
    handleSubscribe(req, res, sseManager, tradeBuffer, aggregator)
    return
  }

  res.writeHead(404)
  res.end()
})

server.listen(PORT, async () => {
  console.log(`ingestion service listening on :${PORT}`)
  const db = await getDb()
  connectAndStream(tradeBuffer, aggregator, sseManager, db)
})
