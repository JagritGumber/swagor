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
  gap: '8px',
})

export const pauseButton = css({
  appearance: 'none',
  border: '1px solid rgba(245, 158, 11, 0.3)',
  borderRadius: '6px',
  backgroundColor: 'rgba(245, 158, 11, 0.08)',
  color: '#f59e0b',
  fontFamily: FONT_UI,
  fontSize: '12px',
  fontWeight: 600,
  padding: '7px 14px',
  cursor: 'pointer',
  transition: 'background-color 0.15s, border-color 0.15s',
  '&:hover': { backgroundColor: 'rgba(245, 158, 11, 0.15)', borderColor: 'rgba(245, 158, 11, 0.50)' },
})

export const stopButton = css({
  appearance: 'none',
  border: '1px solid rgba(255, 80, 80, 0.3)',
  borderRadius: '6px',
  backgroundColor: 'rgba(255, 80, 80, 0.08)',
  color: '#ff5050',
  fontFamily: FONT_UI,
  fontSize: '12px',
  fontWeight: 600,
  padding: '7px 14px',
  cursor: 'pointer',
  transition: 'background-color 0.15s, border-color 0.15s',
  '&:hover': { backgroundColor: 'rgba(255, 80, 80, 0.15)', borderColor: 'rgba(255, 80, 80, 0.50)' },
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
