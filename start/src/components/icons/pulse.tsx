export interface PulseIconProps {
  size?: number
  className?: string
}

export function PulseIcon({ size = 24, className }: PulseIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 256 256"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="24"
      className={className}
      aria-hidden="true"
    >
      <polyline points="32 128 80 128 104 64 128 192 152 104 176 128 224 128" />
    </svg>
  )
}
