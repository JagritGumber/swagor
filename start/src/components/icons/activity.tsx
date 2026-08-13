export interface ActivityIconProps {
  size?: number
  className?: string
}

export function ActivityIcon({ size = 24, className }: ActivityIconProps) {
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
      <circle cx="128" cy="128" r="96" opacity="0.2" />
      <circle cx="128" cy="128" r="96" />
      <polyline points="128 80 128 128 160 128" />
    </svg>
  )
}
