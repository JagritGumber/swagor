// Tooltip component — uses position: fixed to escape overflow containers
import { clientEntry, css, on, type Handle, type RemixNode, type SerializableProps } from 'remix/ui'
import { FONT_UI } from '../constants/theme.ts'
import { InfoIcon } from './icons/info.tsx'

const TOOLTIP_HEIGHT = 30
const GAP = 8
const VIEWPORT_PAD = 8
const SHOW_DELAY = 220

const triggerStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  cursor: 'help',
  color: '#6b7280',
  transition: 'color 0.15s',
  '&:hover': { color: '#94a3b8' },
})

const base = {
  position: 'fixed',
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
  transition: 'opacity 0.15s ease, transform 0.15s ease, filter 0.15s ease',
} as const

const tooltipStyle = (pos: { top: number; left: number }, above: boolean, shown: boolean) => css({
  ...base,
  top: `${pos.top}px`,
  left: `${pos.left}px`,
  transform: shown
    ? 'translateX(-50%) scale(1)'
    : 'translateX(-50%) scale(0.92)',
  transformOrigin: above ? 'bottom center' : 'top center',
  opacity: shown ? 1 : 0,
  filter: shown ? 'blur(0px)' : 'blur(4px)',
})

interface TooltipProps extends SerializableProps {
  content: string
  children?: RemixNode
}

export const Tooltip = clientEntry(
  import.meta.url,
  function Tooltip(handle: Handle<TooltipProps>) {
    let positioned = false
    let shown = false
    let pos = { top: 0, left: 0 }
    let above = true
    let showTimer: ReturnType<typeof setTimeout> | null = null

    return () => {
      const { content, children } = handle.props

      return (
        <span
          mix={[
            triggerStyle,
            on<HTMLElement>('mouseenter', (e) => {
              if (showTimer) clearTimeout(showTimer)

              const rect = (e.target as HTMLElement).getBoundingClientRect()
              const vw = window.innerWidth

              const spaceAbove = rect.top
              above = spaceAbove >= TOOLTIP_HEIGHT + GAP + VIEWPORT_PAD

              pos = {
                top: above
                  ? rect.top - GAP - TOOLTIP_HEIGHT
                  : rect.bottom + GAP,
                left: Math.max(VIEWPORT_PAD, Math.min(rect.left + rect.width / 2, vw - VIEWPORT_PAD)),
              }

              positioned = true
              handle.update()

              showTimer = setTimeout(() => {
                shown = true
                handle.update()
              }, SHOW_DELAY)
            }),
            on<HTMLElement>('mouseleave', () => {
              if (showTimer) { clearTimeout(showTimer); showTimer = null }
              shown = false
              handle.update()
            }),
          ]}
        >
          {children ?? <InfoIcon size={16} variant="bold" />}
          {positioned && <span mix={tooltipStyle(pos, above, shown)}>{content}</span>}
        </span>
      )
    }
  },
)
