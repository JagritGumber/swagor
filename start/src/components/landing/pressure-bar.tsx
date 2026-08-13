interface PressureBarProps {
  buyerPressure: number
  sellerPressure: number
}

export function PressureBar({ buyerPressure, sellerPressure }: PressureBarProps) {
  const total = buyerPressure + sellerPressure
  const buyerPct = total > 0 ? Math.round((buyerPressure / total) * 100) : 50
  const sellerPct = 100 - buyerPct

  return (
    <div className="flex flex-col gap-1">
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-white/5">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-[#00d464]/60 transition-[width] duration-300"
          style={{ width: `${buyerPct}%` }}
        />
        <div
          className="absolute inset-y-0 right-0 rounded-full bg-[#ff5050]/60 transition-[width] duration-300"
          style={{ width: `${sellerPct}%` }}
        />
      </div>
      <div className="flex items-center justify-between text-[11px] font-data text-[#94a3b8]">
        <span>{buyerPct}%</span>
        <span>{sellerPct}%</span>
      </div>
    </div>
  )
}
