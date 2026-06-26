import { css } from 'remix/ui'

export const FONT_UI = "'Inter', system-ui, -apple-system, sans-serif"
export const FONT_DATA = "'JetBrains Mono', ui-monospace, monospace"

const widgetBg = css({
  background: 'oklch(0.2 0.008 260)',
  border: '1px solid oklch(0.28 0.01 260)',
  borderRadius: '8px',
  overflow: 'hidden',
})

const widgetHeaderBg = css({
  background: 'oklch(0.16 0.008 260)',
  padding: '8px 14px',
  borderBottom: '1px solid oklch(0.28 0.01 260)',
  fontFamily: FONT_UI,
  fontSize: '10px',
  fontWeight: 600,
  color: 'oklch(0.55 0.03 260)',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
})

const widgetContentStyle = css({
  padding: '14px',
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
  marginTop: '10px',
  paddingTop: '10px',
  borderTop: '1px solid oklch(0.28 0.01 260)',
  fontSize: '10px',
  color: 'oklch(0.5 0.02 260)',
  lineHeight: 1.5,
})

export const widget = {
  base: widgetBg,
  header: widgetHeaderBg,
  content: widgetContentStyle,
  row: dataRowStyle,
  divider: sectionDividerStyle,
}
