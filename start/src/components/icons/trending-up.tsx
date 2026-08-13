export interface TrendingUpIconProps {
  size?: number
  className?: string
}

export function TrendingUpIcon({ size = 24, className }: TrendingUpIconProps) {
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
      <polyline points="232 56 136 152 96 112 24 184" />
      <polyline points="176 56 232 56 232 112" />
    </svg>
  )
}
