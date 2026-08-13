import { useEffect, useRef, useState } from 'react'
import { Identicon } from '@/components/composables/identicon'
import { Button } from '@/components/composables/button'

export interface ProfileMenuProps {
  address: string
}

export function ProfileMenu({ address }: ProfileMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  if (!address) {
    throw new Error('ProfileMenu: address is required')
  }

  const displayAddress = `${address.slice(0, 6)}...${address.slice(-4)}`

  useEffect(() => {
    if (!isOpen) return

    const onDocClick = (e: MouseEvent) => {
      const root = rootRef.current
      if (!root) {
        throw new Error('ProfileMenu: root ref missing during click handler')
      }
      const target = e.target
      if (!(target instanceof Node)) return
      if (!root.contains(target)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('click', onDocClick)
    return () => document.removeEventListener('click', onDocClick)
  }, [isOpen])

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        className="flex h-12 items-center gap-2 border-l border-white/10 px-4 font-ui text-[13px] font-medium text-text-muted outline-none transition-[background-color,transform] duration-150 scale-100 hover:bg-white/5 active:scale-[0.98]"
      >
        <Identicon address={address} size={20} />
        <span className="font-data">{displayAddress}</span>
      </button>

      {isOpen ? (
        <div
          data-profile-dropdown
          className="absolute top-full right-0 z-[100] mt-1 min-w-40 overflow-hidden rounded-lg border border-white/10 bg-[#1a1a1a] p-1 shadow-[0_4px_12px_rgba(0,0,0,0.3)]"
        >
          <Button
            variant="danger"
            className="w-full justify-start"
            onClick={() => {
              window.location.href = '/logout'
            }}
          >
            Sign out
          </Button>
        </div>
      ) : null}
    </div>
  )
}
