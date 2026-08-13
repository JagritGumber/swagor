import { useEffect, useRef, useState } from 'react'
import {
  createChart,
  CandlestickSeries,
  LineSeries,
  CrosshairMode,
  ColorType,
  type UTCTimestamp,
} from 'lightweight-charts'
import type { BacktestResult } from '@/routes/admin/backtest'

interface BacktestPageProps {
  data: BacktestResult | null
  loading: boolean
  error: string | null
}

export function BacktestPage({ data, loading, error }: BacktestPageProps) {
  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-[13px] text-[#8892a4]">
        Running backtest...
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center text-[13px] text-red-400">
        {error}
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex h-full items-center justify-center text-[13px] text-[#8892a4]">
        No data
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[#131722] font-ui text-white">
      <BacktestSummary summary={data.summary} diagnostics={data.diagnostics} asset={data.asset} />
      <div className="flex min-h-0 flex-1 flex-col gap-0 overflow-hidden">
        <div className="min-h-0 flex-1 overflow-hidden">
          <BacktestChart data={data} />
        </div>
        <div className="h-[200px] min-h-[200px] border-t border-[rgba(99,130,190,0.1)] overflow-hidden">
          <EquityCurve outcomes={data.outcomes} />
        </div>
      </div>
    </div>
  )
}

function BacktestSummary({ summary, diagnostics, asset }: { summary: BacktestResult['summary']; diagnostics: BacktestResult['diagnostics']; asset: string }) {
  const stats = [
    { label: 'Asset', value: asset },
    { label: 'Entries', value: summary.entriesOpened },
    { label: 'Outcomes', value: summary.outcomesCount },
    { label: 'Win Rate', value: `${(summary.winRate * 100).toFixed(1)}%` },
    { label: 'Total R', value: summary.totalR > 0 ? `+${summary.totalR.toFixed(2)}R` : `${summary.totalR.toFixed(2)}R`, color: summary.totalR >= 0 ? '#00d4ff' : '#ff5050' },
    { label: 'Max DD', value: `${summary.maxDrawdown.toFixed(2)}R`, color: '#ff5050' },
    { label: 'Buckets', value: diagnostics.bucketCount },
    { label: 'Candles', value: diagnostics.candleCount },
  ]

  return (
    <div className="flex items-center gap-4 border-b border-[rgba(99,130,190,0.1)] px-4 py-2">
      {stats.map((s) => (
        <div key={s.label} className="flex items-center gap-1.5">
          <span className="text-[10px] uppercase tracking-[0.06em] text-[#8892a4]">{s.label}</span>
          <span className="text-[11px] font-semibold" style={{ color: s.color ?? '#e1e4ea' }}>{s.value}</span>
        </div>
      ))}
    </div>
  )
}

function BacktestChart({ data }: { data: BacktestResult }) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container || data.candles.length < 2) return

    const chart = createChart(container, {
      layout: {
        background: { type: ColorType.Solid, color: '#131722' },
        textColor: '#6b7280',
        fontFamily: '"Inter", system-ui, sans-serif',
        fontSize: 10,
      },
      grid: {
        vertLines: { color: 'rgba(99, 130, 190, 0.06)' },
        horzLines: { color: 'rgba(99, 130, 190, 0.06)' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: 'rgba(99, 179, 237, 0.4)', width: 1, labelBackgroundColor: '#1a2332' },
        horzLine: { color: 'rgba(99, 179, 237, 0.4)', width: 1, labelBackgroundColor: '#1a2332' },
      },
      timeScale: { borderColor: 'rgba(99, 130, 190, 0.1)', timeVisible: true },
      rightPriceScale: { borderColor: 'rgba(99, 130, 190, 0.1)', minimumWidth: 80 },
    })

    const series = chart.addSeries(CandlestickSeries, {
      upColor: '#00d4ff',
      downColor: '#ff5050',
      borderUpColor: '#00d4ff',
      borderDownColor: '#ff5050',
      wickUpColor: '#00d4ff',
      wickDownColor: '#ff5050',
    })

    const candleData = data.candles
      .filter(c => c.c > 0)
      .map(c => ({
        time: (c.t / 1000) as UTCTimestamp,
        open: c.o,
        high: c.h,
        low: c.l,
        close: c.c,
      }))
      .sort((a, b) => (a.time as number) - (b.time as number))

    series.setData(candleData)

    const markers = buildTradeMarkers(data.entries, data.outcomes, data.open)
    if (markers.length > 0) {
      series.setMarkers(markers)
    }

    chart.timeScale().fitContent()

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect
        if (width > 0 && height > 0) chart.resize(width, height)
      }
    })
    resizeObserver.observe(container)

    return () => {
      resizeObserver.disconnect()
      chart.remove()
    }
  }, [data])

  if (data.candles.length < 2) {
    return (
      <div className="flex h-full items-center justify-center text-[13px] text-[#8892a4]">
        No candle data for chart
      </div>
    )
  }

  return <div ref={containerRef} className="h-full w-full" />
}

function buildTradeMarkers(
  entries: BacktestResult['entries'],
  outcomes: BacktestResult['outcomes'],
  open: BacktestResult['open'],
) {
  const markers: Array<{
    time: UTCTimestamp
    position: 'belowBar' | 'aboveBar'
    color: string
    shape: 'arrowUp' | 'arrowDown'
    text: string
  }> = []

  const outcomeMap = new Map(outcomes.map(o => [`${o.entryAt}:${o.side}`, o]))

  for (const entry of entries) {
    const ts = (entry.entryAt / 1000) as UTCTimestamp
    const isLong = entry.side === 'long'

    markers.push({
      time: ts,
      position: isLong ? 'belowBar' : 'aboveBar',
      color: '#00d4ff',
      shape: isLong ? 'arrowUp' : 'arrowDown',
      text: `${isLong ? 'L' : 'S'} ${entry.entryPrice.toFixed(2)}`,
    })

    const outcome = outcomeMap.get(`${entry.entryAt}:${entry.side}`)
    if (outcome) {
      const exitTs = (outcome.exitAt / 1000) as UTCTimestamp
      const isWin = outcome.r > 0
      markers.push({
        time: exitTs,
        position: isWin ? 'aboveBar' : 'belowBar',
        color: isWin ? '#00d4ff' : '#ff5050',
        shape: isWin ? 'arrowDown' : 'arrowUp',
        text: `${outcome.exitReason} ${outcome.r > 0 ? '+' : ''}${outcome.r.toFixed(2)}R`,
      })
    }
  }

  if (open) {
    markers.push({
      time: (open.entryAt / 1000) as UTCTimestamp,
      position: open.side === 'long' ? 'belowBar' : 'aboveBar',
      color: '#f59e0b',
      shape: open.side === 'long' ? 'arrowUp' : 'arrowDown',
      text: `OPEN ${open.entryPrice.toFixed(2)}`,
    })
  }

  return markers.sort((a, b) => (a.time as number) - (b.time as number))
}

function EquityCurve({ outcomes }: { outcomes: BacktestResult['outcomes'] }) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container || outcomes.length < 2) return

    const chart = createChart(container, {
      layout: {
        background: { type: ColorType.Solid, color: '#131722' },
        textColor: '#6b7280',
        fontFamily: '"Inter", system-ui, sans-serif',
        fontSize: 10,
      },
      grid: {
        vertLines: { color: 'rgba(99, 130, 190, 0.06)' },
        horzLines: { color: 'rgba(99, 130, 190, 0.06)' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: 'rgba(99, 179, 237, 0.4)', width: 1, labelBackgroundColor: '#1a2332' },
        horzLine: { color: 'rgba(99, 179, 237, 0.4)', width: 1, labelBackgroundColor: '#1a2332' },
      },
      timeScale: { borderColor: 'rgba(99, 130, 190, 0.1)', timeVisible: true },
      rightPriceScale: { borderColor: 'rgba(99, 130, 190, 0.1)', minimumWidth: 60 },
    })

    const series = chart.addSeries(LineSeries, {
      color: '#00d4ff',
      lineWidth: 2,
      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 3,
      lastValueVisible: true,
      priceLineVisible: false,
    })

    let equity = 0
    const equityData = outcomes
      .map(o => {
        equity += o.r
        return {
          time: (o.exitAt / 1000) as UTCTimestamp,
          value: Math.round(equity * 100) / 100,
        }
      })
      .sort((a, b) => (a.time as number) - (b.time as number))

    series.setData(equityData)
    chart.timeScale().fitContent()

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect
        if (width > 0 && height > 0) chart.resize(width, height)
      }
    })
    resizeObserver.observe(container)

    return () => {
      resizeObserver.disconnect()
      chart.remove()
    }
  }, [outcomes])

  return <div ref={containerRef} className="h-full w-full" />
}
