export interface ChartIconProps {
  size?: number
  className?: string
}

export function ChartIcon({ size = 24, className }: ChartIconProps) {
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
      <rect x="32" y="128" width="40" height="96" rx="8" />
      <rect x="108" y="80" width="40" height="144" rx="8" />
      <rect x="184" y="32" width="40" height="192" rx="8" />
    </svg>
  )
}
