import { clientEntry, type Handle, type SerializableProps, ref, css, on } from 'remix/ui'
import { Identicon } from './identicon.tsx'
import { Button } from './button.tsx'
import { FONT_UI, TEXT_MUTED } from '../constants/theme.ts'

const contentBase = css({
  position: 'absolute',
  top: '100%',
  right: 0,
  marginTop: '4px',
  background: '#1a1a1a',
  border: '1px solid rgba(255, 255, 255, 0.10)',
  borderRadius: '8px',
  padding: '4px',
  minWidth: '160px',
  zIndex: 100,
  overflow: 'hidden',
  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
})

export const ProfileMenu = clientEntry(
  import.meta.url,
  function ProfileMenu(handle: Handle<{ address: string } & SerializableProps>) {
    let isOpen = false

    return () => {
      const address = handle.props.address
      const displayAddress = `${address.slice(0, 6)}...${address.slice(-4)}`

      return (
        <div
          mix={[
            css({ position: 'relative' }),
            ref((node: HTMLElement, signal: AbortSignal) => {
              const onClick = (e: MouseEvent) => {
                const target = e.target as Node
                if (!node.contains(target)) {
                  if (isOpen) { isOpen = false; handle.update() }
                  return
                }
                const dropdown = node.querySelector<HTMLElement>('[data-profile-dropdown]')
                if (dropdown && dropdown.contains(target)) return
                isOpen = !isOpen
                handle.update()
              }
              document.addEventListener('click', onClick)
              signal.addEventListener('abort', () => document.removeEventListener('click', onClick))
            }),
          ]}
        >
          <div
            mix={css({
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              color: TEXT_MUTED,
              fontSize: '13px',
              fontFamily: FONT_UI,
              fontWeight: 500,
              padding: '0 16px',
              borderLeft: '1px solid rgba(255, 255, 255, 0.10)',
              height: '48px',
              cursor: 'pointer',
              transition: 'background-color 0.15s, transform 0.1s',
              transform: 'scale(1)',
              outline: 'none',
              '&:hover': { background: 'rgba(255, 255, 255, 0.05)' },
              '&:active': { transform: 'scale(0.98)' },
            })}
          >
            <Identicon address={address} size={20} />
            <span mix={css({ fontFamily: "'JetBrains Mono', ui-monospace, monospace" })}>
              {displayAddress}
            </span>
          </div>

          {isOpen && (
            <div data-profile-dropdown mix={contentBase}>
              <Button
                variant="danger"
                mix={[
                  css({ width: '100%', justifyContent: 'flex-start' }),
                  on<HTMLButtonElement>('click', () => { window.location.href = '/logout' }),
                ]}
              >
                Sign out
              </Button>
            </div>
          )}
        </div>
      )
    }
  },
)
