// Dashboard styles — top bar, dividers, status dot, equity, risk, pause button
import { css } from 'remix/ui'
import { SURFACE_BODY, FONT_UI, FONT_DATA } from '../../constants/theme.ts'
import type { RiskLevel } from './types.ts'

export const page = css({
  backgroundColor: SURFACE_BODY,
  color: '#ffffff',
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  fontFamily: FONT_UI,
})

export const topBar = css({
  display: 'flex',
  alignItems: 'center',
  padding: '14px 24px',
  borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
  gap: '0',
})

export const section = css({
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  padding: '0 28px',
  '&:first-child': { paddingLeft: '0' },
})

export const sectionCol = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '2px',
})

export const divider = css({
  width: '1px',
  height: '36px',
  backgroundColor: 'rgba(255, 255, 255, 0.06)',
  flexShrink: 0,
})

export const dot = css({
  width: '8px',
  height: '8px',
  borderRadius: '50%',
  backgroundColor: '#00ff85',
  flexShrink: 0,
})

export const statusText = css({
  fontSize: '14px',
  fontWeight: 500,
  color: '#f1f5f9',
  fontFamily: FONT_UI,
})

export const statusSub = css({
  fontSize: '11px',
  fontWeight: 400,
  color: '#6b7280',
  fontFamily: FONT_UI,
})

export const equityValue = css({
  fontSize: '22px',
  fontWeight: 700,
  color: '#f1f5f9',
  fontFamily: FONT_UI,
  fontVariantNumeric: 'tabular-nums',
})

export const equityLabel = css({
  fontSize: '10px',
  fontWeight: 400,
  color: '#6b7280',
  textTransform: 'uppercase',
  letterSpacing: '0.12em',
  fontFamily: FONT_DATA,
})

export const changePill = (up: boolean) => css({
  fontSize: '13px',
  fontWeight: 600,
  color: up ? '#00ff85' : '#ff5050',
  fontFamily: FONT_UI,
  fontVariantNumeric: 'tabular-nums',
})

export const riskColors: Record<RiskLevel, string> = {
  low: '#00ff85',
  medium: '#f59e0b',
  high: '#ff5050',
}

export const riskText = css({
  fontSize: '13px',
  fontWeight: 500,
  color: '#6b7280',
  fontFamily: FONT_UI,
})

export const pauseButton = css({
  appearance: 'none',
  border: '1px solid rgba(255, 255, 255, 0.08)',
  borderRadius: '6px',
  background: 'transparent',
  color: '#6b7280',
  fontFamily: FONT_UI,
  fontSize: '12px',
  fontWeight: 500,
  padding: '5px 14px',
  cursor: 'pointer',
  marginLeft: 'auto',
  transition: 'color 0.15s, border-color 0.15s',
  '&:hover': { color: '#f1f5f9', borderColor: 'rgba(255, 255, 255, 0.18)' },
})

export const content = css({
  flex: 1,
  overflow: 'auto',
})
