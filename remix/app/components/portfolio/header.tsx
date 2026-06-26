import type { Handle } from 'remix/ui'
import { css } from 'remix/ui'

import type { ReaderReadSuccess } from '../../types/reader.ts'
import { FONT_UI, FONT_DATA } from '../../constants/theme.ts'

const headerStyle = css({
  background: 'oklch(0.14 0.008 260)',
  borderBottom: '1px solid oklch(0.26 0.01 260)',
  padding: '10px 20px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  fontFamily: FONT_UI,
  fontSize: '11px',
})

const headerTitleStyle = css({
  color: 'oklch(0.55 0.03 260)',
  fontWeight: 500,
})

const headerValueStyle = css({
  fontFamily: FONT_DATA,
  color: 'oklch(0.75 0.02 260)',
  fontWeight: 600,
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
        ARC TRADER <span mix={headerValueStyle}>| {now} UTC</span>
      </span>
      <span mix={headerTitleStyle}>
        {read.asset} <span mix={headerValueStyle}>| {read.interval}</span>
      </span>
    </div>
  )
}
