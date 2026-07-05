// Dashboard styles — clean modern design, no cards, just sections
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
  padding: '24px 32px',
})

export const statusSection = css({
  marginBottom: '24px',
})

export const statusText = css({
  fontSize: '18px',
  fontWeight: 600,
  color: '#f1f5f9',
  fontFamily: FONT_UI,
  marginBottom: '4px',
})

export const statusSub = css({
  fontSize: '13px',
  fontWeight: 400,
  color: '#6b7280',
  fontFamily: FONT_UI,
})

export const divider = css({
  height: '1px',
  backgroundColor: 'rgba(255, 255, 255, 0.06)',
  marginBottom: '24px',
})

export const dataSection = css({
  display: 'flex',
  gap: '48px',
})

export const dataBlock = css({
  flex: 1,
})

export const dataLabel = css({
  fontSize: '12px',
  fontWeight: 500,
  color: '#6b7280',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  fontFamily: FONT_UI,
  marginBottom: '4px',
})

export const dataValue = css({
  fontSize: '24px',
  fontWeight: 600,
  color: '#f1f5f9',
  fontFamily: FONT_UI,
})

export const riskColors: Record<RiskLevel, string> = {
  low: '#00ff85',
  medium: '#f59e0b',
  high: '#ff5050',
}

export const riskValue = (level: RiskLevel) => css({
  fontSize: '24px',
  fontWeight: 600,
  color: riskColors[level],
  fontFamily: FONT_UI,
  textTransform: 'capitalize',
})

export const content = css({
  flex: 1,
  overflow: 'auto',
})
