// Dashboard-2 styles — separated sections with gaps and cards
import { css } from 'remix/ui'
import { SURFACE_BODY, FONT_UI } from '../../constants/theme.ts'
import type { RiskLevel, ActivityEntry } from './types.ts'

export const page = css({
  backgroundColor: SURFACE_BODY,
  color: '#ffffff',
  display: 'flex',
  flexDirection: 'column',
  fontFamily: FONT_UI,
  overflow: 'auto',
})

export const dashboardGrid = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '16px',
  padding: '24px 32px',
})

// Top bar — 4 separated cards
export const topBar = css({
  display: 'grid',
  gridTemplateColumns: '3fr 1fr 1fr 1fr',
  gap: '16px',
})

export const statusSection = css({
  padding: '20px 24px',
  background: 'rgba(255, 255, 255, 0.03)',
  border: '1px solid rgba(255, 255, 255, 0.10)',
  borderRadius: '8px',
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
  background: 'rgba(255, 255, 255, 0.03)',
  border: '1px solid rgba(255, 255, 255, 0.10)',
  borderRadius: '8px',
})

export const riskBlock = css({
  padding: '20px 24px',
  background: 'rgba(255, 255, 255, 0.03)',
  border: '1px solid rgba(255, 255, 255, 0.10)',
  borderRadius: '8px',
})

export const emptyBlock = css({
  padding: '20px 24px',
  background: 'rgba(255, 255, 255, 0.03)',
  border: '1px solid rgba(255, 255, 255, 0.10)',
  borderRadius: '8px',
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

export const changeText = (up: boolean) => css({
  fontSize: '12px',
  fontWeight: 500,
  color: up ? '#00ff85' : '#ff5050',
  fontFamily: FONT_UI,
  marginTop: '2px',
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

// Metrics row — 6 separated cards
export const metricsRow = css({
  display: 'grid',
  gridTemplateColumns: 'repeat(6, 1fr)',
  gap: '16px',
})

export const metricBlock = css({
  padding: '16px 20px',
  background: 'rgba(255, 255, 255, 0.03)',
  border: '1px solid rgba(255, 255, 255, 0.10)',
  borderRadius: '8px',
})

export const metricLabel = css({
  fontSize: '11px',
  fontWeight: 500,
  color: '#94a3b8',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  fontFamily: FONT_UI,
  marginBottom: '4px',
})

export const metricValue = css({
  fontSize: '18px',
  fontWeight: 600,
  color: '#f1f5f9',
  fontFamily: FONT_UI,
})

export const metricValueGreen = css({
  fontSize: '18px',
  fontWeight: 600,
  color: '#00ff85',
  fontFamily: FONT_UI,
})

export const metricValueRed = css({
  fontSize: '18px',
  fontWeight: 600,
  color: '#ff5050',
  fontFamily: FONT_UI,
})

// Activity row — 3 separated panels
export const activityRow = css({
  display: 'grid',
  gridTemplateColumns: '1fr 1fr 1fr',
  gap: '16px',
  minHeight: '300px',
})

export const panelCard = css({
  background: 'rgba(255, 255, 255, 0.03)',
  border: '1px solid rgba(255, 255, 255, 0.10)',
  borderRadius: '8px',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
})

export const panelHeader = css({
  padding: '16px 24px',
  borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
})

export const panelTitle = css({
  fontSize: '13px',
  fontWeight: 600,
  color: '#f1f5f9',
  fontFamily: FONT_UI,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
})

export const panelContent = css({
  flex: 1,
  overflow: 'auto',
  padding: '16px 0',
})

export const readRow = css({
  display: 'flex',
  justifyContent: 'space-between',
  padding: '8px 24px',
  borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
  '&:last-child': { borderBottom: 'none' },
})

export const readLabel = css({
  fontSize: '12px',
  fontWeight: 500,
  color: '#94a3b8',
  fontFamily: FONT_UI,
})

export const readValue = css({
  fontSize: '12px',
  fontWeight: 500,
  color: '#f1f5f9',
  fontFamily: FONT_UI,
})

export const positionRow = css({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '10px 24px',
  borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
  '&:last-child': { borderBottom: 'none' },
})

export const positionMarket = css({
  fontSize: '13px',
  fontWeight: 600,
  color: '#f1f5f9',
  fontFamily: FONT_UI,
})

export const positionSide = (side: 'long' | 'short') => css({
  fontSize: '11px',
  fontWeight: 600,
  color: side === 'long' ? '#00ff85' : '#ff5050',
  fontFamily: FONT_UI,
  textTransform: 'uppercase',
})

export const positionPnl = (positive: boolean) => css({
  fontSize: '13px',
  fontWeight: 600,
  color: positive ? '#00ff85' : '#ff5050',
  fontFamily: FONT_UI,
})

export const activityList = css({
  flex: 1,
  overflow: 'auto',
})

export const activityItem = css({
  display: 'flex',
  gap: '12px',
  padding: '10px 24px',
  borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
  '&:last-child': { borderBottom: 'none' },
})

export const activityTime = css({
  fontSize: '11px',
  fontWeight: 500,
  color: '#6b7280',
  fontFamily: "'JetBrains Mono', ui-monospace, monospace",
  whiteSpace: 'nowrap',
  minWidth: '50px',
})

export const activityDot = (type: ActivityEntry['type']) => css({
  width: '6px',
  height: '6px',
  borderRadius: '50%',
  backgroundColor: type === 'success' ? '#00ff85' : type === 'warning' ? '#f59e0b' : type === 'action' ? '#00d4ff' : '#6b7280',
  flexShrink: 0,
  marginTop: '5px',
})

export const activityText = css({
  fontSize: '13px',
  fontWeight: 400,
  color: '#d1d5db',
  fontFamily: FONT_UI,
  lineHeight: 1.4,
})

export const content = css({
  flex: 1,
  overflow: 'auto',
})
