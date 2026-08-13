export interface ArrowLeftIconProps {
  size?: number
  className?: string
}

export function ArrowLeftIcon({ size = 14, className }: ArrowLeftIconProps) {
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
      <polyline points="112 56 40 128 112 200" />
    </svg>
  )
}
