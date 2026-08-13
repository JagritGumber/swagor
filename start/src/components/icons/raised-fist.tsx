export interface RaisedFistIconProps {
  size?: number
  className?: string
}

export function RaisedFistIcon({ size = 24, className }: RaisedFistIconProps) {
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
      <path d="M176,104V48a16,16,0,0,0-32,0V96" />
      <path d="M128,96V40a16,16,0,0,0-32,0V104" />
      <path d="M96,104V56a16,16,0,0,0-32,0v72c0,52.48,41.52,96,96,96h8a96,96,0,0,0,96-96V104a16,16,0,0,0-32,0v16" />
    </svg>
  )
}
