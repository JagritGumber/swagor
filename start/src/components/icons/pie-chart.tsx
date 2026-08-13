export interface PieChartIconProps {
  size?: number
  className?: string
}

export function PieChartIcon({ size = 24, className }: PieChartIconProps) {
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
      <path d="M223.79,147.59A96,96,0,1,1,108.41,32.21a96,96,0,0,0,115.38,115.38Z" />
      <path d="M176,80V48h32" />
    </svg>
  )
}
