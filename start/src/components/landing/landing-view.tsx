import { useEffect, useState } from 'react'
import { connectLiveJudgment, type JudgmentUpdate } from '@/data/live-judgment'
import { LandingChartEntry } from './chart-entry'
import { EquityCurve } from './equity-curve'
import { JudgmentPanel } from './judgment-panel'
import { OpenPositions } from './open-positions'
import { PortfolioPulse } from './portfolio-pulse'
import { TradeHistory } from './trade-history'
import type { Asset } from './tabs'
import type { LandingPortfolio, LandingViewProps } from './types'

export function LandingView({ assets, activeAsset: initialAsset }: LandingViewProps) {
  const [activeAsset, setActiveAsset] = useState<Asset>(initialAsset)
  const [judgment, setJudgment] = useState<JudgmentUpdate | null>(null)
  const [updatedAt, setUpdatedAt] = useState<number | null>(null)
  const [activeTab, setActiveTab] = useState<'positions' | 'history' | 'equity'>('positions')

  useEffect(() => {
    setActiveAsset(initialAsset)
  }, [initialAsset])

  useEffect(() => {
    const abort = new AbortController()
    connectLiveJudgment(
      activeAsset,
      {
        onJudgment: (data) => {
          setJudgment(data)
          setUpdatedAt(data.updatedAt)
        },
        onError: () => {},
      },
      abort.signal,
    )
    return () => abort.abort()
  }, [activeAsset])

  const assetData = assets[activeAsset]
  const candles = assetData?.candles ?? []
  const segments = assetData?.segments ?? []
  const auction = assetData?.auction ?? null
  const read = assetData?.read ?? null
  const portfolio: LandingPortfolio | null = assetData?.portfolio ?? null

  const regime = judgment?.regime
    ? { ...judgment.regime, label: judgment.regime.mode }
    : (assetData?.regime ?? null)

  const panelAuction = judgment?.auction
    ? {
        ...judgment.auction,
        profile: assetData?.auction?.profile ?? null,
        level: assetData?.auction?.level ?? null,
      }
    : auction

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-surface-body font-ui text-white">
      <PortfolioPulse portfolio={portfolio} />

      <div className="relative flex min-h-0 flex-1 flex-col">
        <LandingChartEntry
          candles={candles}
          segments={segments}
          asset={activeAsset}
          interval="1h"
          auction={auction}
        />
        <JudgmentPanel
          regime={regime}
          auction={panelAuction}
          read={read}
          updatedAt={updatedAt}
        />
      </div>

      <div className="border-t border-white/10">
        <div className="flex border-b border-white/10">
          {(['positions', 'history', 'equity'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-1.5 text-xs font-mono transition-colors ${
                activeTab === tab
                  ? 'border-b border-white text-white'
                  : 'text-white/40 hover:text-white/60'
              }`}
            >
              {tab === 'positions' && 'Open Positions'}
              {tab === 'history' && 'Trade History'}
              {tab === 'equity' && 'Equity Curve'}
            </button>
          ))}
        </div>
        <div className="max-h-40 overflow-y-auto">
          {activeTab === 'positions' && (
            <OpenPositions positions={portfolio?.positions ?? []} />
          )}
          {activeTab === 'history' && (
            <TradeHistory positions={portfolio?.positions ?? []} />
          )}
          {activeTab === 'equity' && (
            <EquityCurve data={portfolio?.equityCurve ?? []} />
          )}
        </div>
      </div>
    </div>
  )
}
