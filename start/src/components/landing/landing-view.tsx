import { useEffect, useState } from 'react'
import { connectLiveJudgment, type JudgmentUpdate } from '@/data/live-judgment'
import { LandingChartEntry } from './chart-entry'
import { JudgmentPanel } from './judgment-panel'
import { LandingTabs, type Asset } from './tabs'
import type { LandingViewProps } from './types'

export function LandingView({ assets, activeAsset: initialAsset }: LandingViewProps) {
  const [activeAsset, setActiveAsset] = useState<Asset>(initialAsset)
  const [judgment, setJudgment] = useState<JudgmentUpdate | null>(null)
  const [updatedAt, setUpdatedAt] = useState<number | null>(null)

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

  function handleAssetChange(asset: Asset) {
    setActiveAsset(asset)
    setJudgment(null)
    setUpdatedAt(null)
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-surface-body font-ui text-white">
      <LandingTabs active={activeAsset} onChange={handleAssetChange} />
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
    </div>
  )
}
