import type { Handle } from 'remix/ui'
import { clientEntry, ref } from 'remix/ui'
import { Document } from '@/document'
import { LandingChartEntry } from './chart-entry'
import { LandingTabs, type Asset } from './tabs'
import { JudgmentPanel } from './judgment-panel'
import { connectLiveJudgment } from '@/data/live-judgment'
import type { JudgmentUpdate } from '@/data/live-judgment'
import { routes } from '@/routes'
import type { LandingRegime, LandingAuction, LandingViewProps } from '@/pages/landing/types'
import * as s from '@/pages/landing/style'

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
    let assets: LandingViewProps['assets'] = {} as LandingViewProps['assets']
    let activeAsset: Asset = 'ETH'
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

    handle.signal.addEventListener('abort', () => {
      if (sseAbort) sseAbort.abort()
    })

    return () => (
      <div
        mix={ref((node, signal) => {
          if (!(node instanceof HTMLElement)) return
          try {
            const data = readLandingAssets()
            assets = data.assets
            activeAsset = data.activeAsset
            startSSE(activeAsset)
            handle.update()
          } catch (e) {
            console.error('[LandingView] Failed to read landing assets:', e)
          }
        })}
      >
        {LandingTabs({ active: activeAsset, onChange: (asset: Asset) => {
          activeAsset = asset
          judgment = null
          updatedAt = null
          startSSE(asset)
          handle.update()
        }})}
        <div mix={s.chartArea}>
          <script id="landing-chart-data" type="application/json">
            {JSON.stringify({ candles: assets[activeAsset]?.candles ?? [], segments: assets[activeAsset]?.segments ?? [], auction: assets[activeAsset]?.auction })}
          </script>
          <LandingChartEntry />
          <JudgmentPanel
            regime={judgment?.regime ? { ...judgment.regime, label: judgment.regime.mode } : assets[activeAsset]?.regime ?? null}
            auction={judgment?.auction ? { ...judgment.auction, profile: assets[activeAsset]?.auction?.profile ?? null, level: assets[activeAsset]?.auction?.level ?? null } : assets[activeAsset]?.auction ?? null}
            read={assets[activeAsset]?.read ?? null}
            updatedAt={updatedAt}
          />
        </div>
      </div>
    )
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
