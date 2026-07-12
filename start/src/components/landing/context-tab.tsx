import { Crosshair, TrendUp, HandFist, Shield, Pulse } from '@phosphor-icons/react'
import { PressureBar } from './pressure-bar'
import type { LandingAssetData } from './types'

interface ContextTabProps {
  data: LandingAssetData
}

const REGIME_LABEL: Record<string, string> = {
  'range': 'Ranging',
  'trend-up': 'Trending Up',
  'trend-down': 'Trending Down',
  'high-vol': 'High Volatility',
  'unknown': 'Unclear',
}

const REGIME_COLOR: Record<string, string> = {
  'range': 'text-[#6496ff]',
  'trend-up': 'text-[#00d4ff]',
  'trend-down': 'text-[#ff5050]',
  'high-vol': 'text-[#f5c542]',
  'unknown': 'text-[#6b7280]',
}

const STANCE_LABEL: Record<string, string> = {
  'possible-long': 'Looking Long',
  'possible-short': 'Looking Short',
  'watch-long-confirmation': 'Watching for Long',
  'watch-short-confirmation': 'Watching for Short',
  'wait': 'Waiting',
  'avoid-balanced-auction': 'Avoiding',
  'no-trade': 'Neutral',
}

const CONVICTION_LABEL: Record<string, string> = {
  'possible-long': 'Medium',
  'possible-short': 'Medium',
  'watch-long-confirmation': 'Low',
  'watch-short-confirmation': 'Low',
  'wait': 'Low',
  'avoid-balanced-auction': 'Low',
  'no-trade': 'Low',
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-1 items-start gap-3 border-r border-white/[0.06] px-4 py-4 last:border-r-0">
      <div className="text-[#00d4ff]">{icon}</div>
      <div className="flex flex-col">
        <span className="text-[11px] font-medium uppercase tracking-[0.06em] text-[#94a3b8]">{title}</span>
        {children}
      </div>
    </div>
  )
}

export function ContextTab({ data }: ContextTabProps) {
  const stance = data.read?.stance ?? 'no-trade'
  const orderflow = data.read?.orderflow ?? null
  const buyerPressure = orderflow ? Math.max(0, orderflow.pressure === 'buyer' ? 60 + orderflow.delta * 2 : 40 - orderflow.delta * 2) : 50

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      <Section icon={<Crosshair size={24} />} title="Regime">
        <span className={`text-sm font-semibold ${REGIME_COLOR[data.regime?.mode ?? 'unknown']}`}>
          {REGIME_LABEL[data.regime?.mode ?? 'unknown']}
        </span>
      </Section>

      <Section icon={<TrendUp size={24} />} title="Bias">
        <span className="text-sm font-semibold text-white">{STANCE_LABEL[stance] ?? 'Neutral'}</span>
      </Section>

      <Section icon={<HandFist size={24} />} title="Conviction">
        <span className="text-sm font-semibold text-white">{CONVICTION_LABEL[stance]}</span>
      </Section>

      <Section icon={<Shield size={24} />} title="Risk">
        <span className="text-sm font-semibold text-[#f5c542]">Medium</span>
      </Section>

      <Section icon={<Pulse size={24} />} title="Orderflow">
        <div className="w-40">
          <PressureBar buyerPressure={buyerPressure} sellerPressure={100 - buyerPressure} />
        </div>
      </Section>
    </div>
  )
}
