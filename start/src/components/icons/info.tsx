export interface InfoIconProps {
  size?: number
  variant?: 'filled' | 'bold'
  className?: string
}

export function InfoIcon({ size = 16, variant = 'bold', className }: InfoIconProps) {
  if (variant === 'bold') {
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
        shapeRendering="geometricPrecision"
        className={className}
        aria-hidden="true"
      >
        <circle cx="124" cy="84" r="16" fill="currentColor" stroke="none" />
        <circle cx="128" cy="128" r="96" />
        <path d="M120,124a8,8,0,0,1,8,8v36a8,8,0,0,0,8,8" />
      </svg>
    )
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 256 256"
      fill="currentColor"
      shapeRendering="geometricPrecision"
      className={className}
      aria-hidden="true"
    >
      <path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216Zm16-40a8,8,0,0,1-8,8,16,16,0,0,1-16-16V128a8,8,0,0,1,0-16,16,16,0,0,1,16,16v40A8,8,0,0,1,144,176ZM112,84a12,12,0,1,1,12,12A12,12,0,0,1,112,84Z" />
    </svg>
  )
}
