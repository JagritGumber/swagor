// Dashboard styles — status left, equity+risk badges right
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
  padding: '16px 24px',
  borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
  gap: '24px',
})

export const statusSection = css({
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  flex: 1,
})

export const statusDot = css({
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
  marginBottom: '2px',
})

export const statusSub = css({
  fontSize: '11px',
  fontWeight: 400,
  color: '#6b7280',
  fontFamily: FONT_UI,
})

export const badgesSection = css({
  display: 'flex',
  gap: '12px',
  alignItems: 'center',
})

export const badge = css({
  backgroundColor: 'rgba(255, 255, 255, 0.03)',
  border: '1px solid rgba(255, 255, 255, 0.06)',
  borderRadius: '8px',
  padding: '10px 16px',
  minWidth: '140px',
})

export const equityBadge = css({
  backgroundColor: 'rgba(255, 255, 255, 0.03)',
  border: '1px solid rgba(255, 255, 255, 0.06)',
  borderRadius: '8px',
  padding: '10px 16px',
  minWidth: '180px',
})

export const equityLabel = css({
  fontSize: '10px',
  fontWeight: 500,
  color: '#6b7280',
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
  fontFamily: FONT_DATA,
  marginBottom: '4px',
})

export const equityValue = css({
  fontSize: '20px',
  fontWeight: 700,
  color: '#f1f5f9',
  fontFamily: FONT_UI,
  fontVariantNumeric: 'tabular-nums',
})

export const changePill = (up: boolean) => css({
  fontSize: '12px',
  fontWeight: 600,
  color: up ? '#00ff85' : '#ff5050',
  fontFamily: FONT_UI,
  fontVariantNumeric: 'tabular-nums',
})

export const riskBadge = css({
  backgroundColor: 'rgba(255, 255, 255, 0.03)',
  border: '1px solid rgba(255, 255, 255, 0.06)',
  borderRadius: '8px',
  padding: '10px 16px',
})

export const riskLabel = css({
  fontSize: '10px',
  fontWeight: 500,
  color: '#6b7280',
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
  fontFamily: FONT_DATA,
  marginBottom: '4px',
})

export const riskColors: Record<RiskLevel, string> = {
  low: '#00ff85',
  medium: '#f59e0b',
  high: '#ff5050',
}

export const riskValue = (level: RiskLevel) => css({
  fontSize: '14px',
  fontWeight: 600,
  color: riskColors[level],
  fontFamily: FONT_UI,
  textTransform: 'capitalize',
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
  padding: '6px 14px',
  cursor: 'pointer',
  transition: 'color 0.15s, border-color 0.15s',
  '&:hover': { color: '#f1f5f9', borderColor: 'rgba(255, 255, 255, 0.18)' },
})

export const content = css({
  flex: 1,
  overflow: 'auto',
})
