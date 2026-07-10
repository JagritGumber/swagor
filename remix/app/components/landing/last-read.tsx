import type { Handle } from 'remix/ui'
import * as s from '@/pages/landing/style'

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

export function LastRead(handle: Handle<LastReadProps>) {
  return () => (
    <div mix={s.lastRead}>
      <span mix={s.lastReadLabel}>Last read</span>
      <span mix={s.lastReadValue}>{formatRelativeTime(handle.props.updatedAt)}</span>
    </div>
  )
}
