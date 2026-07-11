import { createFileRoute } from '@tanstack/react-router'
import { ASSETS, type Asset } from '@/components/landing/tabs'
import { LandingView } from '@/components/landing/landing-view'
import type { LandingAssetData } from '@/components/landing/types'
import type { AgentReadResult } from '@/server/build-agent-read'

function emptyAssetData(): LandingAssetData {
  return { candles: [], segments: [], auction: null, regime: null, read: null, portfolio: null }
}

function buildAssets(
  activeKey: Asset,
  activeData: LandingAssetData,
): Record<Asset, LandingAssetData> {
  const assets = {} as Record<Asset, LandingAssetData>
  for (const key of ASSETS) {
    assets[key] = key === activeKey ? activeData : emptyAssetData()
  }
  return assets
}

function isAsset(value: string): value is Asset {
  return (ASSETS as readonly string[]).includes(value)
}

function mapAgentReadToAssetData(result: AgentReadResult): LandingAssetData {
  const { candles, segments, regime, auction, read, equity } = result
  return {
    candles,
    segments,
    auction: auction
      ? {
          location: auction.location,
          locationLabel: auction.locationLabel,
          bias: auction.bias,
          narrative: auction.narrative,
          profile: auction.profile
            ? {
                poc: auction.profile.poc,
                valueAreaLow: auction.profile.valueAreaLow,
                valueAreaHigh: auction.profile.valueAreaHigh,
                bins: auction.profile.bins,
              }
            : null,
          level: auction.level,
        }
      : null,
    regime: regime
      ? {
          mode: regime.mode,
          label: regime.label,
          rangePct: regime.rangePct,
          driftPct: regime.driftPct,
          directionalEfficiency: regime.directionalEfficiency,
        }
      : null,
    read,
    equity: equity ?? null,
  }
}

async function ensureXhrPolyfill(): Promise<void> {
  if (typeof globalThis.XMLHttpRequest !== 'undefined') return
  try {
    const mod = await import('xhr2')
    const XHR2 = (mod as { default?: typeof XMLHttpRequest }).default ?? (mod as unknown as typeof XMLHttpRequest)
    globalThis.XMLHttpRequest = XHR2 as typeof XMLHttpRequest
  } catch {}
}

export const Route = createFileRoute('/live/$asset')({
  head: () => ({
    meta: [
      { title: 'Selbo - Live' },
      { name: 'color-scheme', content: 'dark' },
    ],
  }),
  loader: async ({ params }) => {
    const assetKey: Asset = isAsset(params.asset.toUpperCase()) ? params.asset.toUpperCase() : 'ETH'
    const url = new URL(`http://local?asset=${assetKey}`)

    try {
      await ensureXhrPolyfill()
      const { buildAgentRead } = await import('@/server/build-agent-read')
      const result = await buildAgentRead(url)

      if (result.error) {
        return {
          assets: buildAssets(assetKey, emptyAssetData()),
          activeAsset: assetKey,
        }
      }

      const key: Asset = isAsset(result.asset) ? result.asset : assetKey
      return {
        assets: buildAssets(key, mapAgentReadToAssetData(result)),
        activeAsset: key,
      }
    } catch (err) {
      return {
        assets: buildAssets(assetKey, emptyAssetData()),
        activeAsset: assetKey,
      }
    }
  },
  component: LiveRoute,
})

function LiveRoute() {
  const { assets, activeAsset } = Route.useLoaderData()
  return <LandingView assets={assets} activeAsset={activeAsset} page="live" />
}
