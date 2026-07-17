import { EquityChart } from './equity-chart'
import { EquityMetrics } from './equity-metrics'
import { SignalsPanel } from '@/components/shadow/signals-panel'
import type { SelboEquityData } from '@/data/selbo-equity'

interface SelboEquityPageProps {
  data: SelboEquityData
}

export function SelboEquityPage({ data }: SelboEquityPageProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-surface-body font-ui text-white">
      <EquityMetrics
        totalEquity={data.totalEquity}
        dailyChange={data.dailyChange}
        dailyChangePct={data.dailyChangePct}
      />

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="sticky top-0 border-b border-border-default bg-surface-panel px-4 py-2">
            <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#8892a4]">
              Equity Curve
            </span>
          </div>
          <div className="flex-1 overflow-hidden p-4">
            <EquityChart data={data.equityCurve} />
          </div>
        </div>

        <div className="w-72 border-l border-border-default bg-surface-panel">
          <SignalsPanel />
        </div>
      </div>
    </div>
  )
}
