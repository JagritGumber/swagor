const ASSETS = ['SOL', 'BTC', 'ETH', 'XRP', 'DOGE'] as const

export type Asset = (typeof ASSETS)[number]

interface LandingTabsProps {
  active: Asset
  onChange: (asset: Asset) => void
}

export function LandingTabs({ active, onChange }: LandingTabsProps) {
  return (
    <div className="flex gap-0.5 border-b border-white/[0.06] bg-[rgba(10,14,20,0.8)] px-gap-6 py-2">
      {ASSETS.map((asset) => {
        const isActive = active === asset
        return (
          <button
            key={asset}
            type="button"
            onClick={() => onChange(asset)}
            className={[
              'cursor-pointer rounded border-none px-4 py-2 font-data text-[13px] font-semibold transition-all duration-150',
              isActive
                ? 'bg-white/10 text-white'
                : 'bg-transparent text-[#8892a4] hover:bg-white/5 hover:text-white',
            ].join(' ')}
          >
            {asset}
          </button>
        )
      })}
    </div>
  )
}

export { ASSETS }
