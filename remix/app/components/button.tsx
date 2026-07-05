import type { Handle, RemixNode } from 'remix/ui'
import { css } from 'remix/ui'

type Variant = 'primary' | 'ghost' | 'outline' | 'danger'
type Size = 'sm' | 'md' | 'lg'

interface ButtonProps {
  variant?: Variant
  size?: Size
  disabled?: boolean
  type?: 'button' | 'submit' | 'reset'
  children?: RemixNode
  mix?: unknown
  title?: string
}

const base = css({
  appearance: 'none',
  border: 0,
  borderRadius: '8px',
  fontFamily: "'Inter', system-ui, sans-serif",
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  transition: 'opacity 0.15s, transform 0.1s',
  transform: 'scale(1)',
  '&:active': { transform: 'scale(0.97)' },
  '&:focus': { outline: 'none' },
  '&:focus-visible': { outline: '2px solid #00ff85', outlineOffset: '2px' },
  ':disabled': { opacity: 0.4, cursor: 'not-allowed' },
  '@keyframes buttonBlurIn': {
    from: { opacity: 0.6, filter: 'blur(3px)' },
    to: { opacity: 1, filter: 'blur(0)' },
  },
  animation: 'buttonBlurIn 0.2s ease-out both',
})

const variants: Record<Variant, ReturnType<typeof css>> = {
  primary: css({ background: '#00ff85', color: '#000', '&:hover': { background: '#33ff9a' } }),
  ghost: css({ background: 'transparent', color: 'inherit', '&:hover': { background: 'rgba(255, 255, 255, 0.08)' } }),
  outline: css({ background: 'transparent', border: '1px solid #1e293b', color: '#e2e8f0', '&:hover': { borderColor: '#334155', background: 'rgba(255, 255, 255, 0.04)' } }),
  danger: css({ background: 'transparent', color: '#ff5050', '&:hover': { background: 'rgba(255, 80, 80, 0.1)' } }),
}

const sizes: Record<Size, ReturnType<typeof css>> = {
  sm: css({ padding: '4px 10px', fontSize: '11px', fontWeight: 500 }),
  md: css({ padding: '12px 24px', fontSize: '15px', fontWeight: 600 }),
  lg: css({ padding: '16px 32px', fontSize: '16px', fontWeight: 600 }),
}

export function Button(handle: Handle<ButtonProps>) {
  return () => {
    const { variant = 'primary', size = 'md', disabled, type = 'button', children, mix: extraMix, title } = handle.props
    const composed = extraMix
      ? Array.isArray(extraMix)
        ? [base, variants[variant], sizes[size], ...extraMix]
        : [base, variants[variant], sizes[size], extraMix]
      : [base, variants[variant], sizes[size]]
    return (
      <button type={type} disabled={disabled} title={title} mix={composed}>
        {children}
      </button>
    )
  }
}
