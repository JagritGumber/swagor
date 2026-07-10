import { clientEntry, on, type Handle } from 'remix/ui'
import { InfoIcon } from '@/components/icons/info'
import { triggerStyle, hiddenStyle, tooltipStyle, tooltipAnim, GAP, VIEWPORT_PAD, SHOW_DELAY } from './styles.ts'
import type { TooltipProps } from './types.ts'

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

              const measured = document.getElementById(tooltipId)
              let tipW = 150
              let tipH = 28
              if (measured) {
                tipW = measured.offsetWidth || tipW
                tipH = measured.offsetHeight || tipH
              }

              const spaceAbove = triggerRect.top
              const spaceBelow = vh - triggerRect.bottom
              above = spaceAbove >= tipH + GAP + VIEWPORT_PAD
                || spaceAbove >= spaceBelow

              const centerX = triggerRect.left + triggerRect.width / 2
              const minX = VIEWPORT_PAD
              const maxX = vw - VIEWPORT_PAD - tipW
              const x = Math.max(minX, Math.min(centerX - tipW / 2, maxX))

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
          {!positioned && (
            <span id={tooltipId} mix={hiddenStyle}>{content}</span>
          )}
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
