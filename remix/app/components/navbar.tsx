import { css } from 'remix/ui'
import { SURFACE_HEADER, BORDER_HEADER, TEXT_PRIMARY, FONT_UI } from '../constants/theme.ts'

export function Navbar() {
  return () => (
    <div
      mix={css({
        background: SURFACE_HEADER,
        borderBottom: `1px solid ${BORDER_HEADER}`,
        height: '48px',
        display: 'flex',
        alignItems: 'center',
        padding: '0 24px',
        fontFamily: FONT_UI,
        fontSize: '16px',
        color: TEXT_PRIMARY,
        fontWeight: 500,
      })}
    >
      Selbo
    </div>
  )
}
