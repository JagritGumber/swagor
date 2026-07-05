// Dashboard styles — 8fr 2fr 2fr grid, border-left separators
import { css } from 'remix/ui'
import { SURFACE_BODY, FONT_UI } from '../../constants/theme.ts'
import type { RiskLevel } from './types.ts'

export const page = css({
  backgroundColor: SURFACE_BODY,
  color: '#ffffff',
  display: 'flex',
  flexDirection: 'column',
  fontFamily: FONT_UI,
})

export const topBar = css({
  display: 'grid',
  gridTemplateColumns: '6fr 2fr 2fr 2fr',
  borderBottom: '1px solid rgba(255, 255, 255, 0.10)',
})

export const statusSection = css({
  padding: '20px 24px',
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

export const equityBlock = css({
  padding: '20px 24px',
  borderLeft: '1px solid rgba(255, 255, 255, 0.10)',
})

export const riskBlock = css({
  padding: '20px 24px',
  borderLeft: '1px solid rgba(255, 255, 255, 0.10)',
})

export const emptyBlock = css({
  padding: '20px 24px',
  borderLeft: '1px solid rgba(255, 255, 255, 0.10)',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  alignItems: 'flex-start',
  gap: '8px',
})

export const tradingLabel = css({
  fontSize: '11px',
  fontWeight: 500,
  color: '#94a3b8',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  fontFamily: FONT_UI,
})

export const toggleButton = (active: boolean) => css({
  appearance: 'none',
  border: `1px solid ${active ? 'rgba(0, 255, 133, 0.3)' : 'rgba(255, 255, 255, 0.10)'}`,
  borderRadius: '20px',
  backgroundColor: active ? 'rgba(0, 255, 133, 0.10)' : 'rgba(255, 255, 255, 0.05)',
  width: '44px',
  height: '24px',
  cursor: 'pointer',
  position: 'relative',
  transition: 'background-color 0.2s, border-color 0.2s',
  transform: 'scale(1)',
  '&:active': { transform: 'scale(0.95)' },
})

export const toggleKnob = (active: boolean) => css({
  position: 'absolute',
  top: '3px',
  left: active ? '23px' : '3px',
  width: '16px',
  height: '16px',
  borderRadius: '50%',
  backgroundColor: active ? '#00ff85' : '#6b7280',
  transition: 'left 0.2s, background-color 0.2s',
})

export const dataLabel = css({
  fontSize: '11px',
  fontWeight: 500,
  color: '#94a3b8',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  fontFamily: FONT_UI,
  marginBottom: '2px',
})

export const dataValue = css({
  fontSize: '20px',
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
  fontSize: '20px',
  fontWeight: 600,
  color: riskColors[level],
  fontFamily: FONT_UI,
  textTransform: 'capitalize',
})

export const content = css({
  flex: 1,
  overflow: 'auto',
})
