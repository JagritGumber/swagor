export interface CrosshairIconProps {
  size?: number
  className?: string
}

export function CrosshairIcon({ size = 24, className }: CrosshairIconProps) {
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
      <circle cx="128" cy="128" r="88" />
      <circle cx="128" cy="128" r="40" />
      <line x1="128" y1="16" x2="128" y2="88" />
      <line x1="128" y1="168" x2="128" y2="240" />
      <line x1="16" y1="128" x2="88" y2="128" />
      <line x1="168" y1="128" x2="240" y2="128" />
    </svg>
  )
}
