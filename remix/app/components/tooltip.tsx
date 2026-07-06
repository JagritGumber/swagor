// Tooltip component — uses position: fixed to escape overflow containers
import { clientEntry, css, on, type Handle, type RemixNode, type SerializableProps } from 'remix/ui'
import { FONT_UI } from '../constants/theme.ts'

const triggerStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  cursor: 'help',
  color: '#6b7280',
  fontSize: '12px',
  fontFamily: FONT_UI,
  '&:hover': { color: '#94a3b8' },
})

const tooltipStyle = (pos: { top: number; left: number }) => css({
  position: 'fixed',
  top: `${pos.top}px`,
  left: `${pos.left}px`,
  transform: 'translateX(-50%)',
  padding: '6px 10px',
  borderRadius: '6px',
  backgroundColor: '#1e293b',
  border: '1px solid rgba(255, 255, 255, 0.10)',
  color: '#e2e8f0',
  fontSize: '11px',
  fontWeight: 500,
  fontFamily: FONT_UI,
  whiteSpace: 'nowrap',
  pointerEvents: 'none',
  zIndex: 9999,
})

interface TooltipProps extends SerializableProps {
  content: string
  children?: RemixNode
}

export const Tooltip = clientEntry(
  import.meta.url,
  function Tooltip(handle: Handle<TooltipProps>) {
    let visible = false
    let pos = { top: 0, left: 0 }

    return () => {
      const { content, children } = handle.props

      return (
        <span
          mix={[
            triggerStyle,
            on<HTMLElement>('mouseenter', (e) => {
              const rect = (e.target as HTMLElement).getBoundingClientRect()
              pos = { top: rect.top - 8, left: rect.left + rect.width / 2 }
              visible = true
              handle.update()
            }),
            on<HTMLElement>('mouseleave', () => {
              visible = false
              handle.update()
            }),
          ]}
        >
          {children ?? '\u2139'}
          {visible && <span mix={tooltipStyle(pos)}>{content}</span>}
        </span>
      )
    }
  },
)
