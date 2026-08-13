import { Link } from '@tanstack/react-router'
import { Hammer, ChartBar, Pulse } from '@phosphor-icons/react'

export interface NavbarProps {
  activePage?: 'live' | 'portfolio'
}

function navLinkClass(active: boolean): string {
  return [
    'font-medium no-underline px-3 py-1 rounded transition-[transform,background-color,color] duration-150 scale-100 active:scale-95',
    active
      ? 'text-white bg-white/10'
      : 'text-[#8892a4] bg-transparent hover:text-white',
  ].join(' ')
}

export function Navbar({ activePage = 'portfolio' }: NavbarProps) {
  return (
    <div className="flex h-12 items-center bg-surface-header px-gap-6 font-ui text-sm font-medium text-text-primary border-b border-border-header">
      <Link to="/" className="flex items-center gap-2 text-base font-semibold text-text-primary no-underline">
        <Hammer size={18} className="text-[#00d4ff]" />
        Selbo
      </Link>

      <nav className="ml-8 flex items-center gap-1">
        <Link
          to="/"
          className={navLinkClass(activePage === 'portfolio')}
        >
          <span className="flex items-center gap-1.5">
            <ChartBar size={14} />
            Portfolio
          </span>
        </Link>
        <Link
          to="/live/ETH"
          className={navLinkClass(activePage === 'live')}
        >
          <span className="flex items-center gap-1.5">
            <Pulse size={14} />
            Live
          </span>
        </Link>
      </nav>
    </div>
  )
}
