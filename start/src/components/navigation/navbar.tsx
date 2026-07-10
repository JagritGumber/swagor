import { Link } from '@tanstack/react-router'
import { NativeSelect, NativeSelectOption } from '@/components/composables/native-select'
import { ProfileMenu } from './profile-menu'

export interface NavbarUser {
  address: string
}

export interface NavbarProps {
  user?: NavbarUser | null
  hideLinks?: boolean
  currentPath?: string
  publicRoute?: boolean
}

function navLinkClass(active: boolean): string {
  return [
    'font-medium no-underline px-2 py-1 rounded transition-[transform,background-color,color] duration-150 scale-100 active:scale-95',
    active
      ? 'text-text-primary bg-white/10 border-b-2 border-accent-green'
      : 'text-text-muted bg-transparent border-b-2 border-transparent hover:text-text-primary',
  ].join(' ')
}

export function Navbar({
  user,
  hideLinks = false,
  currentPath = '',
  publicRoute = false,
}: NavbarProps) {
  const displayAddress = user
    ? `${user.address.slice(0, 6)}...${user.address.slice(-4)}`
    : null

  if (publicRoute) {
    return (
      <nav className="flex h-12 items-center bg-surface-header px-gap-6 font-ui text-sm font-medium text-text-primary border-b border-border-header">
        <Link to="/" className="text-base font-semibold text-text-primary no-underline">
          Selbo
        </Link>
      </nav>
    )
  }

  return (
    <div className="flex h-12 items-center gap-8 border-b border-border-header bg-surface-header px-gap-6 font-ui text-sm font-medium text-text-primary">
      <Link to="/" className="text-base font-semibold text-text-primary no-underline">
        Selbo
      </Link>

      {!hideLinks ? (
        <nav className="ml-8 flex flex-1 items-baseline gap-gap-6">
          <Link to="/agent" className={navLinkClass(currentPath === '/agent')}>
            Agent
          </Link>
          <Link to="/dashboard" className={navLinkClass(currentPath === '/dashboard')}>
            Dashboard
          </Link>
        </nav>
      ) : null}

      {!hideLinks ? (
        <div className="flex h-full items-center">
          <div className="h-full border-l border-white/10">
            <NativeSelect value="testnet" aria-label="Network">
              <NativeSelectOption value="testnet">Testnet</NativeSelectOption>
              <NativeSelectOption value="mainnet" disabled>
                Mainnet (soon)
              </NativeSelectOption>
            </NativeSelect>
          </div>

          {displayAddress && user ? <ProfileMenu address={user.address} /> : null}
        </div>
      ) : null}

      {!displayAddress && !hideLinks ? (
        <Link
          to="/login"
          className="flex h-full items-center border-l border-white/10 px-4 text-[13px] font-medium text-text-muted no-underline hover:text-text-primary"
        >
          Sign in
        </Link>
      ) : null}
    </div>
  )
}
