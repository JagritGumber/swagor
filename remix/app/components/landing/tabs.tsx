import { on } from 'remix/ui'
import * as s from '@/pages/landing/style'

const ASSETS = ['SOL', 'BTC', 'ETH', 'XRP', 'DOGE'] as const

export type Asset = typeof ASSETS[number]

interface LandingTabsProps {
  active: Asset
  onChange: (asset: Asset) => void
}

export function LandingTabs({ active, onChange }: LandingTabsProps) {
  return (
    <div mix={s.tabBar}>
      {ASSETS.map((asset) => (
        <button
          key={asset}
          mix={[s.tab, active === asset && s.tabActive, on<HTMLButtonElement>('click', () => onChange(asset))]}
        >
          {asset}
        </button>
      ))}
    </div>
  )
}

export { ASSETS }
