import { useId, useRef, useState, type MouseEvent } from 'react'
import { InfoIcon } from '@/components/icons/info'
import type { TooltipProps } from './types'

const GAP = 8
const VIEWPORT_PAD = 8
const SHOW_DELAY = 220

export function Tooltip({ content, children }: TooltipProps) {
  const tooltipId = useId()
  const showTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [positioned, setPositioned] = useState(false)
  const [shown, setShown] = useState(false)
  const [above, setAbove] = useState(true)
  const [pos, setPos] = useState({ top: 0, left: 0 })

  function clearShowTimer() {
    if (showTimer.current) {
      clearTimeout(showTimer.current)
      showTimer.current = null
    }
  }

  function handleMouseEnter(e: MouseEvent<HTMLElement>) {
    clearShowTimer()

    const trigger = e.currentTarget
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
    const nextAbove = spaceAbove >= tipH + GAP + VIEWPORT_PAD || spaceAbove >= spaceBelow

    const centerX = triggerRect.left + triggerRect.width / 2
    const minX = VIEWPORT_PAD
    const maxX = vw - VIEWPORT_PAD - tipW
    const x = Math.max(minX, Math.min(centerX - tipW / 2, maxX))

    const y = nextAbove ? triggerRect.top - GAP - tipH : triggerRect.bottom + GAP

    setAbove(nextAbove)
    setPos({ top: y, left: x })
    setPositioned(true)

    showTimer.current = setTimeout(() => {
      setShown(true)
    }, SHOW_DELAY)
  }

  function handleMouseLeave() {
    clearShowTimer()
    setShown(false)
  }

  const tipBase =
    'fixed px-[10px] py-1.5 rounded-md bg-[#1e293b] border border-border-default text-[#e2e8f0] text-[11px] font-medium font-ui whitespace-nowrap pointer-events-none z-[9999]'

  return (
    <span
      className="inline-flex items-center cursor-help text-[#6b7280] transition-colors duration-150 hover:text-[#94a3b8]"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children ?? <InfoIcon size={16} variant="bold" />}
      {!positioned && (
        <span id={tooltipId} className={`${tipBase} invisible top-[-9999px] left-[-9999px]`}>
          {content}
        </span>
      )}
      {positioned && (
        <span
          id={tooltipId}
          className={tipBase}
          style={{
            top: pos.top,
            left: pos.left,
            transformOrigin: above ? 'bottom center' : 'top center',
            transform: shown ? 'scale(1)' : 'scale(0.92)',
            opacity: shown ? 1 : 0,
            filter: shown ? 'blur(0px)' : 'blur(4px)',
            transition: 'opacity 0.15s ease, transform 0.15s ease, filter 0.15s ease',
          }}
        >
          {content}
        </span>
      )}
    </span>
  )
}
