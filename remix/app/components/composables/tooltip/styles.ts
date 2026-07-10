import { css } from 'remix/ui'
import { FONT_UI } from '../../../constants/theme.ts'

export const GAP = 8
export const VIEWPORT_PAD = 8
export const SHOW_DELAY = 220

export const triggerStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  cursor: 'help',
  color: '#6b7280',
  transition: 'color 0.15s',
  '&:hover': { color: '#94a3b8' },
})

export const base = {
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

export const hiddenStyle = css({
  ...base,
  visibility: 'hidden',
  position: 'fixed',
  top: '-9999px',
  left: '-9999px',
})

export const tooltipStyle = (pos: { top: number; left: number }, above: boolean) => css({
  ...base,
  top: `${pos.top}px`,
  left: `${pos.left}px`,
  transformOrigin: above ? 'bottom center' : 'top center',
})

export const tooltipAnim = (shown: boolean) => css({
  transform: shown ? 'scale(1)' : 'scale(0.92)',
  opacity: shown ? 1 : 0,
  filter: shown ? 'blur(0px)' : 'blur(4px)',
  transition: 'opacity 0.15s ease, transform 0.15s ease, filter 0.15s ease',
})
