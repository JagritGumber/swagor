interface EquityMetricsProps {
  totalEquity: number
  dailyChange: number
  dailyChangePct: number
}

export function EquityMetrics({ totalEquity, dailyChange, dailyChangePct }: EquityMetricsProps) {
  const isPositive = dailyChange >= 0

  return (
    <div className="flex items-center gap-6 border-b border-border-default bg-surface-panel px-6 py-4">
      <div className="flex flex-col gap-1">
        <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-[#8892a4]">
          Total Equity
        </span>
        <span className="font-data text-[20px] font-semibold text-white">
          ${totalEquity.toFixed(2)}
        </span>
      </div>

      <div className="h-8 w-px bg-border-default" />

      <div className="flex flex-col gap-1">
        <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-[#8892a4]">
          Daily Change
        </span>
        <div className="flex items-baseline gap-2">
          <span className={`font-data text-[18px] font-semibold ${isPositive ? 'text-[#00d464]' : 'text-[#ff5050]'}`}>
            {isPositive ? '+' : ''}${dailyChange.toFixed(2)}
          </span>
          <span className={`font-data text-[13px] font-medium ${isPositive ? 'text-[#00d464]' : 'text-[#ff5050]'}`}>
            {isPositive ? '+' : ''}{dailyChangePct.toFixed(2)}%
          </span>
        </div>
      </div>
    </div>
  )
}
