import type { Handle } from 'remix/ui'

interface ArrowRightIconProps {
  size?: number
}

export function ArrowRightIcon(handle: Handle<ArrowRightIconProps>) {
  const { size = 14 } = handle.props
  return () => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 256 256"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="16"
    >
      <line x1="40" y1="128" x2="216" y2="128" />
      <polyline points="144 56 216 128 144 200" />
    </svg>
  )
}
