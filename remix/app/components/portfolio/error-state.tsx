import type { Handle } from 'remix/ui'
import { css } from 'remix/ui'

import { FONT_STACK } from '../../constants/theme.ts'

interface ErrorStateProps {
  message: string
}

export function ErrorState(handle: Handle<ErrorStateProps>) {
  return () => (
    <div
      mix={css({
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        gap: '12px',
        padding: '24px',
        background: '#000',
        color: 'var(--text-primary)',
        fontFamily: FONT_STACK,
      })}
    >
      <span
        mix={css({
          fontSize: '24px',
          color: '#f85149',
          fontWeight: 700,
        })}
      >
        ERROR
      </span>
      <span
        mix={css({
          color: '#8b949e',
          textAlign: 'center',
          maxWidth: '480px',
          fontSize: '13px',
        })}
      >
        {handle.props.message}
      </span>
    </div>
  )
}
