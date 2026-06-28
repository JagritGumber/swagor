import type { Handle } from 'remix/ui'
import { css } from 'remix/ui'

import { FONT_UI, SURFACE_BODY, NEGATIVE, TEXT_SECONDARY } from '../../constants/theme.ts'

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
        gap: '16px',
        padding: '24px',
        background: SURFACE_BODY,
        fontFamily: FONT_UI,
      })}
    >
      <span
        mix={css({
          fontSize: '20px',
          color: NEGATIVE,
          fontWeight: 700,
          letterSpacing: '0.05em',
        })}
      >
        ERROR
      </span>
      <span
        mix={css({
          color: TEXT_SECONDARY,
          textAlign: 'center',
          maxWidth: '480px',
          fontSize: '12px',
          lineHeight: 1.6,
        })}
      >
        {handle.props.message}
      </span>
    </div>
  )
}
