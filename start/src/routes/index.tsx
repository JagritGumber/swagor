import { createFileRoute } from '@tanstack/react-router'
import { ASSETS, type Asset } from '@/components/landing/tabs'
import { LandingView } from '@/components/landing/landing-view'
import type { LandingAssetData } from '@/components/landing/types'
import type { AgentReadResult } from '@/server/build-agent-read'

function emptyAssetData(): LandingAssetData {
  return { candles: [], segments: [], auction: null, regime: null, read: null }
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
  const { candles, segments, regime, auction, read } = result
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
  }
}

/** Ensure XMLHttpRequest exists for alova xhr adapter under Bun. */
async function ensureXhrPolyfill(): Promise<void> {
  if (typeof globalThis.XMLHttpRequest !== 'undefined') return
  try {
    const mod = await import('xhr2')
    const XHR2 = (mod as { default?: typeof XMLHttpRequest }).default ?? (mod as unknown as typeof XMLHttpRequest)
    globalThis.XMLHttpRequest = XHR2 as typeof XMLHttpRequest
  } catch {
    // Leave unset; buildAgentRead will fail and we fall back to empty assets.
  }
}

export const Route = createFileRoute('/')({
  head: () => ({
    meta: [
      { title: 'Selbo - AI Trading Agent' },
      { name: 'color-scheme', content: 'dark' },
    ],
    links: [
      { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
      { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossOrigin: 'anonymous' },
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap',
      },
    ],
  }),
  loader: async ({ location }) => {
    const url = new URL(location.href, 'http://local')
    const paramAsset = (url.searchParams.get('asset') ?? 'ETH').toUpperCase()
    const assetKey: Asset = isAsset(paramAsset) ? paramAsset : 'ETH'

    try {
      await ensureXhrPolyfill()
      const { buildAgentRead } = await import('@/server/build-agent-read')
      const result = await buildAgentRead(url)

      if (result.error) {
        console.error('[home] buildAgentRead failed:', result.error)
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
      console.error('[home] buildAgentRead failed:', err)
      return {
        assets: buildAssets(assetKey, emptyAssetData()),
        activeAsset: assetKey,
      }
    }
  },
  component: LandingRoute,
})

function LandingRoute() {
  const { assets, activeAsset } = Route.useLoaderData()
  return <LandingView assets={assets} activeAsset={activeAsset} />
}
