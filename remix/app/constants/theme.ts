import { css } from 'remix/ui'

export const FONT_UI = "'Inter', system-ui, -apple-system, sans-serif"
export const FONT_DATA = "'JetBrains Mono', ui-monospace, monospace"

export const GAP_2 = '8px'
export const GAP_4 = '16px'
export const GAP_6 = '24px'
export const GAP_12 = '48px'

export const SURFACE_BODY = '#0a0e14'
export const SURFACE_HEADER = '#0a0e14'
export const SURFACE_WIDGET_HEADER = 'oklch(0.14 0.03 260)'
export const SURFACE_WIDGET = 'oklch(0.11 0.025 260)'
export const BORDER_DEFAULT = 'rgba(255, 255, 255, 0.10)'
export const BORDER_HEADER = 'rgba(255, 255, 255, 0.10)'
export const TEXT_PRIMARY = 'oklch(1 0 0)'
export const TEXT_SECONDARY = 'oklch(1 0 0)'
export const TEXT_MUTED = 'oklch(1 0 0)'
export const TEXT_DATA = 'oklch(1 0 0)'
export const ACCENT_GREEN = '#00ff85'
export const POSITIVE = '#00ff85'
export const NEGATIVE = 'oklch(0.55 0.2 30)'

const widgetBg = css({
  background: SURFACE_WIDGET,
  border: `1px solid ${BORDER_DEFAULT}`,
  borderRadius: '24px',
  overflow: 'hidden',
})

const widgetHeaderBg = css({
  background: SURFACE_WIDGET_HEADER,
  padding: '8px 16px',
  borderBottom: `1px solid ${BORDER_DEFAULT}`,
  fontFamily: FONT_UI,
  fontSize: '10px',
  fontWeight: 600,
  color: TEXT_SECONDARY,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
})

const widgetContentStyle = css({
  padding: '16px',
  fontSize: '12px',
  lineHeight: 1.6,
  fontFamily: FONT_UI,
})

const dataRowStyle = css({
  display: 'flex',
  justifyContent: 'space-between',
  padding: '4px 0',
  fontVariantNumeric: 'tabular-nums',
})

const sectionDividerStyle = css({
  marginTop: '12px',
  paddingTop: '12px',
  borderTop: `1px solid ${BORDER_DEFAULT}`,
  fontSize: '10px',
  color: TEXT_MUTED,
  lineHeight: 1.5,
})

export const widget = {
  base: widgetBg,
  header: widgetHeaderBg,
  content: widgetContentStyle,
  row: dataRowStyle,
  divider: sectionDividerStyle,
}
