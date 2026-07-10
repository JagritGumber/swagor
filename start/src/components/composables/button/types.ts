import type { ButtonHTMLAttributes, ReactNode } from 'react'

export type Variant = 'primary' | 'ghost' | 'outline' | 'danger'
export type Size = 'sm' | 'md' | 'lg'

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  variant?: Variant
  size?: Size
  disabled?: boolean
  type?: 'button' | 'submit' | 'reset'
  children?: ReactNode
  title?: string
  className?: string
}
