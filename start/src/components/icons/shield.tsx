export interface ShieldIconProps {
  size?: number
  className?: string
}

export function ShieldIcon({ size = 24, className }: ShieldIconProps) {
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
      <path d="M128,24S40,64,40,128c0,40,24,72,48,88a24,24,0,0,0,40,0c24-16,48-48,48-88C176,64,128,24,128,24Z" />
    </svg>
  )
}
