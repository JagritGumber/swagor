import type { Handle } from 'remix/ui'
import { css } from 'remix/ui'
import { SURFACE_HEADER, BORDER_HEADER, TEXT_PRIMARY, TEXT_MUTED, FONT_UI } from '../constants/theme.ts'
import { NativeSelect, NativeSelectOption } from './native-select.tsx'
import { ProfileMenu } from './profile-menu.tsx'

export function Navbar(handle: Handle<{ user?: { address: string }; hideLinks?: boolean; currentPath?: string }>) {
  const { user, hideLinks, currentPath } = handle.props

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
          rmx-document
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
              rmx-document
              mix={css({
                color: currentPath === '/agent' ? TEXT_PRIMARY : TEXT_MUTED,
                textDecoration: 'none',
                fontWeight: 500,
                padding: '4px 8px',
                borderRadius: '4px',
                transition: 'transform 0.1s, background-color 0.15s',
                transform: 'scale(1)',
                background: currentPath === '/agent' ? 'rgba(255, 255, 255, 0.10)' : 'transparent',
                borderBottom: currentPath === '/agent' ? '2px solid #00ff85' : '2px solid transparent',
                '&:hover': { color: TEXT_PRIMARY },
                '&:active': { transform: 'scale(0.95)' },
              })}
            >
              Agent
            </a>
            <a
              href="/dashboard"
              rmx-document
              mix={css({
                color: currentPath === '/dashboard' ? TEXT_PRIMARY : TEXT_MUTED,
                textDecoration: 'none',
                fontWeight: 500,
                padding: '4px 8px',
                borderRadius: '4px',
                transition: 'transform 0.1s, background-color 0.15s',
                transform: 'scale(1)',
                background: currentPath === '/dashboard' ? 'rgba(255, 255, 255, 0.10)' : 'transparent',
                borderBottom: currentPath === '/dashboard' ? '2px solid #00ff85' : '2px solid transparent',
                '&:hover': { color: TEXT_PRIMARY },
                '&:active': { transform: 'scale(0.95)' },
              })}
            >
              Dashboard
            </a>
          </nav>
        )}

        {/* Network + Profile */}
        {!hideLinks && (
          <div
            mix={css({
              display: 'flex',
              alignItems: 'center',
              height: '100%',
            })}
          >
            <div
              mix={css({
                borderLeft: '1px solid rgba(255, 255, 255, 0.10)',
                height: '100%',
              })}
            >
              <NativeSelect value="testnet">
                <NativeSelectOption value="testnet">Testnet</NativeSelectOption>
                <NativeSelectOption value="mainnet" disabled>Mainnet (soon)</NativeSelectOption>
              </NativeSelect>
            </div>

            {displayAddress && (
              <ProfileMenu address={user!.address} />
            )}
          </div>
        )}

        {!displayAddress && !hideLinks && (
          <a
            href="/login"
            mix={css({
              color: TEXT_MUTED,
              textDecoration: 'none',
              fontSize: '13px',
              fontWeight: 500,
              borderLeft: '1px solid rgba(255, 255, 255, 0.10)',
              padding: '0 16px',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              '&:hover': { color: TEXT_PRIMARY },
            })}
          >
            Sign in
          </a>
        )}
      </div>
    )
  }
}
