import type { Handle } from 'remix/ui'
import { css } from 'remix/ui'
import { Identicon } from './identicon.tsx'
import { SURFACE_HEADER, BORDER_HEADER, TEXT_PRIMARY, TEXT_MUTED, FONT_UI } from '../constants/theme.ts'

export function Navbar(handle: Handle<{ user?: { address: string }; hideLinks?: boolean }>) {
  const { user, hideLinks } = handle.props

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
          fontSize: '14px',
          color: TEXT_PRIMARY,
          fontWeight: 500,
          gap: '32px',
        })}
      >
        <a
          href="/dashboard"
          mix={css({
            color: TEXT_PRIMARY,
            textDecoration: 'none',
            fontSize: '16px',
            fontWeight: 600,
          })}
        >
          Selbo
        </a>
        {!hideLinks && (
          <nav
            mix={css({
              display: 'flex',
              alignItems: 'baseline',
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
                fontWeight: 500,
                ':hover': { color: TEXT_PRIMARY },
              })}
            >
              Agent
            </a>
            <a
              href="/dashboard"
              mix={css({
                color: TEXT_MUTED,
                textDecoration: 'none',
                fontWeight: 500,
                ':hover': { color: TEXT_PRIMARY },
              })}
            >
              Dashboard
            </a>
          </nav>
        )}

        {/* Network Selector */}
        {!hideLinks && (
          <div
            mix={css({
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '0 16px',
              borderLeft: '1px solid rgba(255, 255, 255, 0.10)',
            })}
          >
            <span
              mix={css({
                fontSize: '11px',
                fontWeight: 500,
                color: '#94a3b8',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                fontFamily: FONT_UI,
              })}
            >
              Network
            </span>
            <select
              mix={css({
                appearance: 'none',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.10)',
                borderRadius: '6px',
                color: TEXT_PRIMARY,
                fontFamily: FONT_UI,
                fontSize: '12px',
                fontWeight: 500,
                padding: '4px 24px 4px 8px',
                cursor: 'pointer',
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath d='M3 4.5L6 7.5L9 4.5' stroke='%2394a3b8' stroke-width='1.5' fill='none'/%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 6px center',
                '&:hover': { borderColor: 'rgba(255, 255, 255, 0.20)' },
                '& option': {
                  background: '#0a0e14',
                  color: '#f1f5f9',
                },
              })}
            >
              <option value="testnet">Testnet</option>
              <option value="mainnet" disabled>Mainnet (soon)</option>
            </select>
          </div>
        )}

        {displayAddress ? (
          <div
            mix={css({
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              color: TEXT_MUTED,
              fontSize: '13px',
              fontFamily: FONT_UI,
              fontWeight: 500,
              padding: '0 16px 0 16px',
              borderLeft: '1px solid rgba(255, 255, 255, 0.10)',
            })}
          >
            <Identicon address={user!.address} size={20} />
            <span
              mix={css({
                fontFamily: "'JetBrains Mono', ui-monospace, monospace",
              })}
            >
              {displayAddress}
            </span>
          </div>
        ) : !hideLinks ? (
          <a
            href="/login"
            mix={css({
              color: TEXT_MUTED,
              textDecoration: 'none',
              fontSize: '13px',
              fontWeight: 500,
              ':hover': { color: TEXT_PRIMARY },
            })}
          >
            Sign in
          </a>
        ) : null}
      </div>
    )
  }
}
