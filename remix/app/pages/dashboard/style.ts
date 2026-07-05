// Dashboard styles — clean modern, grid layout
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
  gridTemplateColumns: '8fr 1fr 2fr 2fr',
  alignItems: 'center',
  padding: '20px 32px',
  borderBottom: '1px solid rgba(255, 255, 255, 0.10)',
  gap: '0',
})

export const statusSection = css({
  minWidth: 0,
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

export const divider = css({
  width: '1px',
  height: '36px',
  backgroundColor: 'rgba(255, 255, 255, 0.10)',
  justifySelf: 'center',
})

export const dataBlock = css({
  padding: '0',
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
