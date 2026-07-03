import type { Handle } from 'remix/ui'
import { css } from 'remix/ui'
import { SURFACE_HEADER, BORDER_HEADER, TEXT_PRIMARY, TEXT_MUTED, FONT_UI } from '../constants/theme.ts'

export function Navbar(handle: Handle<{ user?: { address: string } }>) {
  const { user } = handle.props

  return () => {
    const displayAddress = user
      ? `${user.address.slice(0, 6)}...${user.address.slice(-4)}`
      : null

    return (
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
        <a
          href="/portfolio"
          mix={css({
            color: TEXT_PRIMARY,
            textDecoration: 'none',
          })}
        >
          Selbo
        </a>
        <nav
          mix={css({
            display: 'flex',
            alignItems: 'center',
            gap: '24px',
            marginLeft: '32px',
            flex: 1,
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
        {displayAddress ? (
          <form
            action="/logout"
            method="POST"
            mix={css({ display: 'flex', alignItems: 'center', gap: '12px' })}
          >
            <span
              mix={css({
                fontSize: '12px',
                color: TEXT_MUTED,
                fontFamily: "'JetBrains Mono', ui-monospace, monospace",
              })}
            >
              {displayAddress}
            </span>
            <button
              type="submit"
              mix={css({
                appearance: 'none',
                border: 0,
                background: 'transparent',
                color: TEXT_MUTED,
                fontSize: '12px',
                fontWeight: 500,
                cursor: 'pointer',
                fontFamily: FONT_UI,
                ':hover': { color: TEXT_PRIMARY },
              })}
            >
              Sign out
            </button>
          </form>
        ) : (
          <a
            href="/login"
            mix={css({
              color: TEXT_MUTED,
              textDecoration: 'none',
              fontSize: '12px',
              fontWeight: 500,
              ':hover': { color: TEXT_PRIMARY },
            })}
          >
            Sign in
          </a>
        )}
      </div>
    )
  }
}
