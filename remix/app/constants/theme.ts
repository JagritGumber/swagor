import { css } from 'remix/ui'

export const FONT_STACK =
  "'JetBrains Mono', ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace"

export const widgetStyle = css({
  background: '#1a1a1a',
  border: '1px solid #30363d',
  borderRadius: '4px',
  overflow: 'hidden',
})

export const widgetHeaderStyle = css({
  background: '#0a0a0a',
  padding: '6px 12px',
  borderBottom: '1px solid #30363d',
  fontSize: '11px',
  fontWeight: 700,
  color: '#6e7681',
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
})

export const widgetContentStyle = css({
  padding: '12px',
  fontSize: '12px',
  lineHeight: 1.6,
})

export const dataRowStyle = css({
  display: 'flex',
  justifyContent: 'space-between',
  padding: '3px 0',
  fontVariantNumeric: 'tabular-nums',
})

export const sectionDividerStyle = css({
  marginTop: '8px',
  paddingTop: '8px',
  borderTop: '1px solid #30363d',
  fontSize: '10px',
  color: '#6e7681',
})
