// Tooltip component — measures actual content size and clamps to viewport
import { clientEntry, css, on, type Handle, type RemixNode, type SerializableProps } from 'remix/ui'
import { FONT_UI } from '../constants/theme.ts'
import { InfoIcon } from './icons/info.tsx'

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
} as const

const hiddenStyle = css({
  ...base,
  visibility: 'hidden',
  position: 'fixed',
  top: '-9999px',
  left: '-9999px',
})

const tooltipStyle = (pos: { top: number; left: number }, above: boolean) => css({
  ...base,
  top: `${pos.top}px`,
  left: `${pos.left}px`,
  transformOrigin: above ? 'bottom center' : 'top center',
})

const tooltipAnim = (shown: boolean) => css({
  transform: shown ? 'scale(1)' : 'scale(0.92)',
  opacity: shown ? 1 : 0,
  filter: shown ? 'blur(0px)' : 'blur(4px)',
  transition: 'opacity 0.15s ease, transform 0.15s ease, filter 0.15s ease',
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
    let tooltipId = 'tip-' + Math.random().toString(36).slice(2, 8)

    return () => {
      const { content, children } = handle.props

      return (
        <span
          mix={[
            triggerStyle,
            on<HTMLElement>('mouseenter', (e) => {
              if (showTimer) clearTimeout(showTimer)

              const trigger = e.target as HTMLElement
              const triggerRect = trigger.getBoundingClientRect()
              const vw = window.innerWidth
              const vh = window.innerHeight

              // Measure actual tooltip content size
              const measured = document.getElementById(tooltipId)
              let tipW = 150
              let tipH = 28
              if (measured) {
                tipW = measured.offsetWidth || tipW
                tipH = measured.offsetHeight || tipH
              }

              // Decide above or below
              const spaceAbove = triggerRect.top
              const spaceBelow = vh - triggerRect.bottom
              above = spaceAbove >= tipH + GAP + VIEWPORT_PAD
                || spaceAbove >= spaceBelow

              // Compute x: center on trigger, clamp full content rect to viewport
              const centerX = triggerRect.left + triggerRect.width / 2
              const minX = VIEWPORT_PAD
              const maxX = vw - VIEWPORT_PAD - tipW
              const x = Math.max(minX, Math.min(centerX - tipW / 2, maxX))

              // Compute y: above or below trigger
              const y = above
                ? triggerRect.top - GAP - tipH
                : triggerRect.bottom + GAP

              pos = { top: y, left: x }
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
          {/* Hidden measurement element — always rendered */}
          {!positioned && (
            <span id={tooltipId} mix={hiddenStyle}>{content}</span>
          )}
          {/* Positioned visible tooltip */}
          {positioned && (
            <span
              id={tooltipId}
              mix={[tooltipStyle(pos, above), tooltipAnim(shown)]}
            >
              {content}
            </span>
          )}
        </span>
      )
    }
  },
)
