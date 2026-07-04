import type { Handle } from 'remix/ui'

interface WalletIconProps {
  size?: number
}

export function WalletIcon(handle: Handle<WalletIconProps>) {
  const { size = 24 } = handle.props
  return () => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 256 256"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="24"
    >
      <circle cx="180" cy="136" r="16" />
      <path d="M40,60.73V180a20,20,0,0,0,20,20H204a20,20,0,0,0,20-20V100a20,20,0,0,0-20-20H60.48C49.63,80,40.4,71.57,40,60.73A20,20,0,0,1,60,40H192" />
    </svg>
  )
}
