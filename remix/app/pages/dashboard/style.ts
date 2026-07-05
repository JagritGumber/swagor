// Dashboard styles — compact layout, status left, equity+risk right
import { css } from 'remix/ui'
import { SURFACE_BODY, FONT_UI } from '../../constants/theme.ts'
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
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  padding: '20px 32px',
  borderBottom: '1px solid rgba(255, 255, 255, 0.10)',
})

export const statusSection = css({
  flex: 1,
})

export const statusText = css({
  fontSize: '20px',
  fontWeight: 600,
  color: '#f1f5f9',
  fontFamily: FONT_UI,
  marginBottom: '2px',
})

export const statusSub = css({
  fontSize: '13px',
  fontWeight: 400,
  color: '#94a3b8',
  fontFamily: FONT_UI,
})

export const rightSection = css({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-end',
  gap: '2px',
})

export const equityRow = css({
  display: 'flex',
  alignItems: 'baseline',
  gap: '12px',
})

export const equityValue = css({
  fontSize: '20px',
  fontWeight: 600,
  color: '#f1f5f9',
  fontFamily: FONT_UI,
  fontVariantNumeric: 'tabular-nums',
})

export const changePill = (up: boolean) => css({
  fontSize: '13px',
  fontWeight: 500,
  color: up ? '#00ff85' : '#ff5050',
  fontFamily: FONT_UI,
})

export const riskColors: Record<RiskLevel, string> = {
  low: '#00ff85',
  medium: '#f59e0b',
  high: '#ff5050',
}

export const riskValue = (level: RiskLevel) => css({
  fontSize: '13px',
  fontWeight: 500,
  color: riskColors[level],
  fontFamily: FONT_UI,
})

export const riskLabel = css({
  fontSize: '12px',
  fontWeight: 400,
  color: '#6b7280',
  fontFamily: FONT_UI,
  marginRight: '6px',
})

export const content = css({
  flex: 1,
  overflow: 'auto',
})
