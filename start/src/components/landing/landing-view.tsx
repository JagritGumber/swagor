import { useEffect, useState } from 'react'
import { connectLiveJudgment } from '@/data/live-judgment'
import { getCandles } from '@/data/api'
import { ASSETS, type Asset } from './tabs'
import { LandingChartEntry } from './chart-entry'
import { EquityCurve } from './equity-curve'
import { JudgmentPanel, type MindLogEntry } from './judgment-panel'
import type { LandingEquity, LandingViewProps } from './types'

const REGIME_LABEL: Record<string, string> = {
  'range': 'Ranging',
  'trend-up': 'Trending up',
  'trend-down': 'Trending down',
  'high-vol': 'High volatility',
  'unknown': 'Unclear',
}

const STANCE_LABEL: Record<string, string> = {
  'possible-long': 'Looking at a long',
  'possible-short': 'Looking at a short',
  'watch-long': 'Watching for a long',
  'watch-short': 'Watching for a short',
  'wait': 'Waiting for confirmation',
  'avoid': 'Staying away',
  'avoid-balanced-auction': 'No clear opportunity here',
  'long': 'Looking at a long',
  'short': 'Looking at a short',
  'hold': 'Holding position',
  'exit': 'Exiting position',
  'no-trade': 'No trade right now',
}

export function LandingView({ assets, activeAsset: initialAsset, page = 'portfolio' }: LandingViewProps) {
  const [activeAsset, setActiveAsset] = useState<Asset>(initialAsset)
  const [updatedAt, setUpdatedAt] = useState<number | null>(null)
  const [mindLog, setMindLog] = useState<MindLogEntry[]>(() => {
    const assetData = assets[initialAsset]
    if (!assetData) return []
    const entries: MindLogEntry[] = []
    if (assetData.regime || assetData.auction || assetData.read) {
      const regimeText = assetData.regime
        ? `${REGIME_LABEL[assetData.regime.label] ?? assetData.regime.label}, drift ${assetData.regime.driftPct.toFixed(1)}%`
        : null
      const narrativeText = assetData.read?.narrative ?? assetData.auction?.narrative ?? null
      const stanceText = assetData.read?.stance ? STANCE_LABEL[assetData.read.stance] ?? assetData.read.stance : null
      entries.push({
        timestamp: Date.now(),
        regime: regimeText,
        narrative: narrativeText,
        stance: stanceText,
      })
    }
    return entries
  })

  useEffect(() => {
    setActiveAsset(initialAsset)
  }, [initialAsset])

  const handleAssetChange = (asset: Asset) => {
    window.location.href = `/live/${asset}`
  }

  useEffect(() => {
    const abort = new AbortController()
    connectLiveJudgment(
      activeAsset,
      {
        onJudgment: (data) => {
          setUpdatedAt(data.updatedAt)
          setMindLog((prev) => {
            const regimeText = data.regime
              ? `${REGIME_LABEL[data.regime.mode] ?? data.regime.mode}, drift ${(data.regime.driftPct * 100).toFixed(1)}%`
              : null
            const stanceText = data.stance ? STANCE_LABEL[data.stance] ?? data.stance : null
            const entry: MindLogEntry = {
              timestamp: data.updatedAt,
              regime: regimeText,
              narrative: data.narrative || null,
              stance: stanceText,
            }
            const next = [...prev, entry]
            return next.length > 50 ? next.slice(-50) : next
          })
        },
        onError: () => {},
      },
      abort.signal,
    )
    return () => abort.abort()
  }, [activeAsset])

  const assetData = assets[activeAsset]
  const serverCandles = assetData?.candles ?? []
  const segments = assetData?.segments ?? []
  const auction = assetData?.auction ?? null
  const equity: LandingEquity | null = assetData?.equity ?? null

  const [liveCandles, setLiveCandles] = useState(serverCandles)

  useEffect(() => {
    setLiveCandles(serverCandles)
    if (serverCandles.length > 0) return

    const now = Date.now()
    const intervalMs = 3_600_000
    const start = now - intervalMs * 300
    getCandles(activeAsset, '1h', start, now).then((res) => {
      if (res.ok) setLiveCandles(res.data.candles)
    }).catch(() => {})
  }, [activeAsset, serverCandles])

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-surface-body font-ui text-white">
      {page === 'live' ? (
        <div className="grid min-h-0 flex-1 grid-cols-[2fr_1fr] overflow-hidden">
          <div className="flex min-h-0 flex-col overflow-hidden border-r border-border-default">
            <LandingChartEntry
              candles={liveCandles}
              segments={segments}
              asset={activeAsset}
              interval="1h"
              auction={auction}
            />
          </div>

          <JudgmentPanel log={mindLog} updatedAt={updatedAt} asset={activeAsset} />
        </div>
      ) : (
        <>
          <div className="flex min-h-0 flex-1 overflow-hidden">
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <LandingChartEntry
                candles={liveCandles}
                segments={segments}
                asset={activeAsset}
                interval="1h"
                auction={auction}
              />
            </div>
            <JudgmentPanel log={mindLog} updatedAt={updatedAt} asset={activeAsset} />
          </div>

          <div className="border-t border-border-default">
            <div className="sticky top-0 border-b border-border-default bg-surface-panel px-4 py-2">
              <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#8892a4]">Equity</span>
            </div>
            <EquityCurve data={equity?.equityCurve ?? []} />
          </div>
        </>
      )}
    </div>
  )
}
