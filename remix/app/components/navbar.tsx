import { css } from 'remix/ui'
import { SURFACE_HEADER, BORDER_HEADER, TEXT_PRIMARY, TEXT_MUTED, FONT_UI } from '../constants/theme.ts'

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
        gap: '32px',
      })}
    >
      <span>Selbo</span>
      <nav
        mix={css({
          display: 'flex',
          alignItems: 'center',
          gap: '24px',
          marginLeft: '32px',
        })}
      >
        <a
          href="/agent"
          mix={css({
            color: TEXT_MUTED,
            textDecoration: 'none',
            fontSize: '13px',
            fontWeight: 500,
            ':hover': { color: TEXT_PRIMARY },
          })}
        >
          Agent
        </a>
        <a
          href="/portfolio"
          mix={css({
            color: TEXT_MUTED,
            textDecoration: 'none',
            fontSize: '13px',
            fontWeight: 500,
            ':hover': { color: TEXT_PRIMARY },
          })}
        >
          Portfolio
        </a>
      </nav>
    </div>
  )
}
