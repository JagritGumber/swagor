import type { ButtonProps, Size, Variant } from './types'

const baseClass =
  'appearance-none border-0 rounded-lg font-ui cursor-pointer inline-flex items-center justify-center gap-2 transition-[opacity,transform] duration-150 ease-out scale-100 active:scale-[0.97] focus:outline-none focus-visible:outline-2 focus-visible:outline-accent-green focus-visible:outline-offset-2 disabled:opacity-40 disabled:cursor-not-allowed animate-[buttonBlurIn_0.2s_ease-out_both]'

const variantClass: Record<Variant, string> = {
  primary: 'bg-accent-green text-black hover:bg-[#33e0ff]',
  ghost: 'bg-transparent text-inherit hover:bg-white/8',
  outline:
    'bg-transparent border border-solid border-[#1e293b] text-[#e2e8f0] hover:border-[#334155] hover:bg-white/4',
  danger: 'bg-transparent text-[#ff5050] hover:bg-[rgba(255,80,80,0.1)]',
}

const sizeClass: Record<Size, string> = {
  sm: 'px-2.5 py-1 text-[11px] font-medium',
  md: 'px-6 py-3 text-[15px] font-semibold',
  lg: 'px-8 py-4 text-base font-semibold',
}

export function buttonClass(variant: Variant = 'primary', size: Size = 'md', className?: string): string {
  return [baseClass, variantClass[variant], sizeClass[size], className].filter(Boolean).join(' ')
}

export function Button({
  variant = 'primary',
  size = 'md',
  disabled,
  type = 'button',
  children,
  className,
  title,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled}
      title={title}
      className={buttonClass(variant, size, className)}
      {...rest}
    >
      {children}
    </button>
  )
}
