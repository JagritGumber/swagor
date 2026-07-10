import type { RemixNode } from 'remix/ui'

export type Variant = 'primary' | 'ghost' | 'outline' | 'danger'
export type Size = 'sm' | 'md' | 'lg'

export interface ButtonProps {
  variant?: Variant
  size?: Size
  disabled?: boolean
  type?: 'button' | 'submit' | 'reset'
  children?: RemixNode
  mix?: unknown
  title?: string
}
