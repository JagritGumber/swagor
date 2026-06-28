import type { Handle } from 'remix/ui'
import { css } from 'remix/ui'

import type { ReaderReadSuccess } from '../../types/reader.ts'
import { FONT_UI, FONT_DATA, SURFACE_BODY, BORDER_HEADER, TEXT_SECONDARY, TEXT_DATA } from '../../constants/theme.ts'

const headerStyle = css({
  background: SURFACE_BODY,
  borderBottom: `1px solid ${BORDER_HEADER}`,
  padding: '16px 24px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  fontFamily: FONT_UI,
  fontSize: '13px',
})

const headerTitleStyle = css({
  color: TEXT_SECONDARY,
  fontWeight: 500,
})

const headerValueStyle = css({
  fontFamily: FONT_DATA,
  color: TEXT_DATA,
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
