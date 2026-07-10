export interface ArrowRightIconProps {
  size?: number
  className?: string
}

export function ArrowRightIcon({ size = 14, className }: ArrowRightIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 256 256"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="16"
      className={className}
      aria-hidden="true"
    >
      <line x1="40" y1="128" x2="216" y2="128" />
      <polyline points="144 56 216 128 144 200" />
    </svg>
  )
}
