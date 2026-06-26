import type { Handle } from 'remix/ui'
import { css } from 'remix/ui'

import type { ReaderReadSuccess } from '../../types/reader.ts'

const headerStyle = css({
  background: '#0a0a0a',
  borderBottom: '1px solid #30363d',
  padding: '8px 16px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  fontSize: '12px',
})

const headerTitleStyle = css({
  color: '#8b949e',
  fontWeight: 500,
})

interface HeaderProps {
  read: ReaderReadSuccess
}

export function Header(handle: Handle<HeaderProps>) {
  const { read } = handle.props
  const now = new Date().toISOString().slice(11, 19)

  return () => (
    <div mix={headerStyle}>
      <span mix={headerTitleStyle}>
        ARC TRADER | {now} UTC
      </span>
      <span mix={headerTitleStyle}>
        ASSET: {read.asset} | INTERVAL: {read.interval}
      </span>
    </div>
  )
}
