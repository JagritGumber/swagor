import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { runMarketStoreReaderReplayReport } from '@packages/live-reader'
import { BacktestPage } from '@/components/admin/backtest-page'
import type { CandleInterval } from '@packages/market-data'
import type { ReaderResultEntry, ReaderResultOutcome } from '@packages/strategy-lab/reader/reader-result/types'

const MARKET_STORE_ROOT = 'D:\\Projects\\agoratest\\.data\\market-store'

export type BacktestResult = {
  asset: string
  summary: {
    totalReads: number
    entriesOpened: number
    outcomesCount: number
    winCount: number
    lossCount: number
    totalR: number
    maxDrawdown: number
    winRate: number
  }
  entries: ReaderResultEntry[]
  outcomes: ReaderResultOutcome[]
  open: ReaderResultEntry | null
  candles: Array<{ t: number; o: number; h: number; l: number; c: number; v: number }>
  diagnostics: {
    bucketCount: number
    candleCount: number
    syntheticOrderflowEventCount: number
  }
}

export const Route = createFileRoute('/admin/backtest')({
  component: BacktestRoute,
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url)
        const asset = (url.searchParams.get('asset') ?? 'BTC').toUpperCase()
        const startMonth = url.searchParams.get('start') ?? '2025-05'
        const endMonth = url.searchParams.get('end') ?? '2025-10'
        const interval = (url.searchParams.get('interval') ?? '1h') as CandleInterval

        const [startYear, startMon] = startMonth.split('-').map(Number)
        const [endYear, endMon] = endMonth.split('-').map(Number)
        const startMs = Date.UTC(startYear, startMon - 1, 1)
        const endMs = Date.UTC(endYear, endMon, 0, 23, 59, 59, 999)

        try {
          const report = await runMarketStoreReaderReplayReport({
            rootDir: MARKET_STORE_ROOT,
            venue: 'bybit',
            market: 'trading',
            symbol: `${asset}USDT`,
            interval,
            startMs,
            endMs,
            readIntervalMs: 60_000,
            orderflowWindowMs: 300_000,
          })

          const summary = report.summary
          const winCount = report.outcomes.filter(o => o.r > 0).length
          const lossCount = report.outcomes.filter(o => o.r < 0).length

          const result: BacktestResult = {
            asset,
            summary: {
              totalReads: summary.totalReads,
              entriesOpened: summary.entriesOpened,
              outcomesCount: report.outcomes.length,
              winCount,
              lossCount,
              totalR: report.outcomes.reduce((s, o) => s + o.r, 0),
              maxDrawdown: computeMaxDrawdown(report.outcomes),
              winRate: report.outcomes.length > 0 ? winCount / report.outcomes.length : 0,
            },
            entries: report.entries,
            outcomes: report.outcomes,
            open: report.open,
            candles: report.historySteps.map(s => ({
              t: s.now,
              o: s.read.auction.profile?.poc ?? 0,
              h: s.read.auction.profile?.valueAreaHigh ?? 0,
              l: s.read.auction.profile?.valueAreaLow ?? 0,
              c: s.read.orderflow.lastPrice ?? 0,
              v: s.read.orderflow.tradeCount,
            })),
            diagnostics: report.diagnostics,
          }

          return new Response(JSON.stringify(result), {
            headers: { 'Content-Type': 'application/json' },
          })
        } catch (e) {
          return new Response(JSON.stringify({
            error: e instanceof Error ? e.message : String(e),
          }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          })
        }
      },
    },
  },
})

function BacktestRoute() {
  const [data, setData] = useState<BacktestResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const params = Route.useSearch()

  useEffect(() => {
    const asset = params.asset ?? 'BTC'
    const start = params.start ?? '2025-05'
    const end = params.end ?? '2025-10'
    const interval = params.interval ?? '1h'

    setLoading(true)
    setError(null)

    fetch(`/admin/backtest?asset=${asset}&start=${start}&end=${end}&interval=${interval}`)
      .then(async (res) => {
        const json = await res.json()
        if (!res.ok) throw new Error(json.error ?? 'Request failed')
        setData(json)
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false))
  }, [params.asset, params.start, params.end, params.interval])

  return <BacktestPage data={data} loading={loading} error={error} />
}

function computeMaxDrawdown(outcomes: ReaderResultOutcome[]): number {
  let peak = 0
  let equity = 0
  let maxDd = 0
  for (const o of outcomes) {
    equity += o.r
    if (equity > peak) peak = equity
    const dd = equity - peak
    if (dd < maxDd) maxDd = dd
  }
  return maxDd
}
