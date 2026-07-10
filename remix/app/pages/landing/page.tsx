import type { Handle } from 'remix/ui'
import { clientEntry } from 'remix/ui'
import { Document } from '@/document'
import { LandingChartEntry } from '@/components/landing/chart-entry'
import { LandingTabs, type Asset } from '@/components/landing/tabs'
import { JudgmentPanel } from '@/components/landing/judgment-panel'
import { connectLiveJudgment } from '@/data/live-judgment'
import type { JudgmentUpdate } from '@/data/live-judgment'
import { routes } from '@/routes'
import type { LandingViewProps } from './types.ts'
import * as s from './style.ts'

interface LandingPageProps extends LandingViewProps {
  user?: { address: string }
}

function readLandingAssets(): { assets: LandingViewProps['assets']; activeAsset: Asset } {
  const el = document.getElementById('landing-assets-data')
  if (!(el instanceof HTMLElement)) throw new Error('Missing landing-assets-data')
  return JSON.parse(el.textContent!)
}

const LandingView = clientEntry(
  import.meta.url,
  function LandingView(handle: Handle<{}>) {
    let { assets, activeAsset } = readLandingAssets()
    let judgment: JudgmentUpdate | null = null
    let updatedAt: number | null = null
    let sseAbort: AbortController | null = null

    function startSSE(asset: string) {
      if (sseAbort) sseAbort.abort()
      sseAbort = new AbortController()
      connectLiveJudgment(asset, {
        onJudgment: (data) => {
          judgment = data
          updatedAt = data.updatedAt
          handle.update()
        },
        onError: () => {},
      }, sseAbort.signal)
    }

    startSSE(activeAsset)
    handle.signal.addEventListener('abort', () => {
      if (sseAbort) sseAbort.abort()
    })

    return () => {
      const assetData = assets[activeAsset]
      const regime = judgment?.regime
        ? { ...judgment.regime, label: judgment.regime.mode }
        : assetData?.regime ?? null
      const auction = judgment?.auction
        ? { ...judgment.auction, profile: assetData?.auction?.profile ?? null, level: assetData?.auction?.level ?? null }
        : assetData?.auction ?? null

      return (
        <div mix={s.landingPage}>
          {LandingTabs({ active: activeAsset, onChange: (asset: Asset) => {
            activeAsset = asset
            judgment = null
            updatedAt = null
            startSSE(asset)
            handle.update()
          }})}
          <div mix={s.chartArea}>
            <script id="landing-chart-data" type="application/json">
              {JSON.stringify({ candles: assetData.candles, segments: assetData.segments, auction: assetData.auction })}
            </script>
            <LandingChartEntry />
            <JudgmentPanel
              regime={regime as any}
              auction={auction as any}
              read={assetData?.read ?? null}
              updatedAt={updatedAt}
            />
          </div>
        </div>
      )
    }
  },
)

export function LandingPage(handle: Handle<LandingPageProps>) {
  return () => {
    const { assets, activeAsset, user } = handle.props

    return (
      <Document
        title="Selbo - AI Trading Agent"
        user={user}
        publicRoute
        head={
          <>
            <meta name="color-scheme" content="dark" />
            <link rel="preconnect" href="https://fonts.googleapis.com" />
            <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
            <link
              rel="stylesheet"
              href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap"
            />
            <link rel="stylesheet" href={routes.assets.href({ path: 'app/assets/chart.css' })} />
          </>
        }
      >
        <script id="landing-assets-data" type="application/json">
          {JSON.stringify(assets)}
        </script>
        <LandingView />
      </Document>
    )
  }
}
