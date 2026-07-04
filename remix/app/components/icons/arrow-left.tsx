import type { Handle } from 'remix/ui'

interface ArrowLeftIconProps {
  size?: number
}

export function ArrowLeftIcon(handle: Handle<ArrowLeftIconProps>) {
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
      <polyline points="112 56 40 128 112 200" />
    </svg>
  )
}
