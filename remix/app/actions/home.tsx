import type { AppContext } from '../router.ts'
import { LandingPage } from '../pages/landing/page.tsx'
import { buildAgentRead } from './shared.ts'
import { ASSETS, type Asset } from '@/components/landing/tabs'
import type { LandingAssetData } from '../pages/landing/types.ts'

function emptyAssetData(): LandingAssetData {
  return { candles: [], segments: [], auction: null, regime: null, read: null }
}

function buildAssets(activeKey: Asset, activeData: LandingAssetData): Record<Asset, LandingAssetData> {
  const assets = {} as Record<Asset, LandingAssetData>
  for (const key of ASSETS) {
    assets[key] = key === activeKey ? activeData : emptyAssetData()
  }
  return assets
}

export async function home(context: AppContext) {
  const url = new URL(context.request.url)
  const { candles, segments, regime, auction, read, plan, judgment, portfolio, asset, error } = await buildAgentRead(url)

  if (error) {
    console.error('[home] buildAgentRead failed:', error)
    const assetKey = asset as Asset
    return context.render(<LandingPage assets={buildAssets(assetKey, emptyAssetData())} activeAsset={assetKey} />)
  }

  const assetKey = asset as Asset
  const assetData: LandingAssetData = {
    candles,
    segments,
    auction: auction ? {
      location: auction.location,
      locationLabel: auction.locationLabel,
      bias: auction.bias,
      narrative: auction.narrative,
      profile: auction.profile ? {
        poc: auction.profile.poc,
        valueAreaLow: auction.profile.valueAreaLow,
        valueAreaHigh: auction.profile.valueAreaHigh,
        bins: auction.profile.bins,
      } : null,
      level: auction.level,
    } : null,
    regime: regime ? {
      mode: regime.mode,
      label: regime.label,
      rangePct: regime.rangePct,
      driftPct: regime.driftPct,
      directionalEfficiency: regime.directionalEfficiency,
    } : null,
    read,
  }

  return context.render(
    <LandingPage assets={buildAssets(assetKey, assetData)} activeAsset={assetKey} />,
  )
}
