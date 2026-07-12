export interface PickaxeIconProps {
  size?: number
  className?: string
}

export function PickaxeIcon({ size = 24, className }: PickaxeIconProps) {
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
      <path d="M92.69,216H48a8,8,0,0,1-8-8V163.31" />
      <path d="M216,155.31V208a8,8,0,0,1-8,8H163.31" />
      <path d="M229.66,114.34,141.66,26.34a8,8,0,0,0-11.31,0L101.66,55" />
      <path d="M200,144l-56-56L61.66,171" />
      <line x1="144" y1="112" x2="144" y2="144" />
    </svg>
  )
}
