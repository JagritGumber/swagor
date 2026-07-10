import type { Handle } from 'remix/ui'
import { base, variants, sizes } from './styles.ts'
import type { ButtonProps } from './types.ts'

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
