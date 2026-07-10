interface LastReadProps {
  updatedAt: number
}

function formatRelativeTime(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000)
  if (seconds < 5) return 'just now'
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  return `${hours}h ago`
}

export function LastRead({ updatedAt }: LastReadProps) {
  return (
    <div className="flex items-center justify-between border-t border-white/[0.06] pt-3">
      <span className="text-[11px] uppercase tracking-[0.5px] text-[#8892a4]">Last read</span>
      <span className="font-data text-xs text-[#8892a4]">{formatRelativeTime(updatedAt)}</span>
    </div>
  )
}
