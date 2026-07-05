// Dashboard-2 styles — hero, mixed grids, visual hierarchy
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

// Hero section — full-width status + equity
export const hero = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '32px',
  borderBottom: '1px solid rgba(255, 255, 255, 0.10)',
})

export const heroLeft = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
})

export const heroStatus = css({
  fontSize: '24px',
  fontWeight: 600,
  color: '#f1f5f9',
  fontFamily: FONT_UI,
})

export const heroSub = css({
  fontSize: '14px',
  fontWeight: 400,
  color: '#94a3b8',
  fontFamily: FONT_UI,
})

export const heroRight = css({
  display: 'flex',
  alignItems: 'center',
  gap: '32px',
})

export const equityGroup = css({
  textAlign: 'right',
})

export const equityLabel = css({
  fontSize: '11px',
  fontWeight: 500,
  color: '#94a3b8',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  fontFamily: FONT_UI,
  marginBottom: '4px',
})

export const equityValue = css({
  fontSize: '28px',
  fontWeight: 700,
  color: '#f1f5f9',
  fontFamily: FONT_UI,
})

export const equityChange = (up: boolean) => css({
  fontSize: '13px',
  fontWeight: 500,
  color: up ? '#00ff85' : '#ff5050',
  fontFamily: FONT_UI,
  textAlign: 'right',
})

export const heroMeta = css({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-end',
  gap: '8px',
})

export const riskBadge = (level: RiskLevel) => css({
  fontSize: '12px',
  fontWeight: 600,
  color: riskColors[level],
  fontFamily: FONT_UI,
  padding: '4px 12px',
  borderRadius: '12px',
  background: `${riskColors[level]}15`,
  border: `1px solid ${riskColors[level]}30`,
  textTransform: 'capitalize',
})

export const tradingToggle = css({
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  fontSize: '12px',
  fontWeight: 500,
  color: '#94a3b8',
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

// Section dividers
export const divider = css({
  borderTop: '1px solid rgba(255, 255, 255, 0.10)',
  margin: '0 32px',
})

// Metrics row — 3-col grid, no cards, just data
export const metricsGrid = css({
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  gap: '0',
  padding: '0 32px',
})

export const metricCell = css({
  padding: '24px 0',
  borderRight: '1px solid rgba(255, 255, 255, 0.06)',
  '&:nth-child(3n)': { borderRight: 'none' },
  '&:nth-child(-n+3)': { borderBottom: '1px solid rgba(255, 255, 255, 0.06)' },
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
  fontSize: '20px',
  fontWeight: 600,
  color: '#f1f5f9',
  fontFamily: FONT_UI,
})

export const metricValueGreen = css({
  fontSize: '20px',
  fontWeight: 600,
  color: '#00ff85',
  fontFamily: FONT_UI,
})

export const metricValueRed = css({
  fontSize: '20px',
  fontWeight: 600,
  color: '#ff5050',
  fontFamily: FONT_UI,
})

// Two-panel row — Market Read + Positions
export const twoPanelRow = css({
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '0',
  padding: '0 32px',
})

export const panelHalf = css({
  padding: '24px',
  borderRight: '1px solid rgba(255, 255, 255, 0.06)',
  '&:last-child': { borderRight: 'none' },
})

export const panelTitle = css({
  fontSize: '12px',
  fontWeight: 600,
  color: '#94a3b8',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  fontFamily: FONT_UI,
  marginBottom: '16px',
  paddingBottom: '12px',
  borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
})

export const readRow = css({
  display: 'flex',
  justifyContent: 'space-between',
  padding: '8px 0',
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
  padding: '10px 0',
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

// Full-width sections
export const fullSection = css({
  padding: '0 32px',
})

export const sectionHeader = css({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '20px 0',
  borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
})

export const sectionTitle = css({
  fontSize: '12px',
  fontWeight: 600,
  color: '#94a3b8',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  fontFamily: FONT_UI,
})

export const activityList = css({
  maxHeight: '300px',
  overflow: 'auto',
})

export const activityItem = css({
  display: 'flex',
  gap: '12px',
  padding: '12px 0',
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

// Performance row — horizontal scroll of metrics
export const perfGrid = css({
  display: 'grid',
  gridTemplateColumns: 'repeat(6, 1fr)',
  gap: '0',
  padding: '0 32px',
})

export const perfCell = css({
  padding: '20px 0',
  borderRight: '1px solid rgba(255, 255, 255, 0.06)',
  '&:last-child': { borderRight: 'none' },
})

export const perfLabel = css({
  fontSize: '11px',
  fontWeight: 500,
  color: '#94a3b8',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  fontFamily: FONT_UI,
  marginBottom: '4px',
})

export const perfValue = css({
  fontSize: '18px',
  fontWeight: 600,
  color: '#f1f5f9',
  fontFamily: FONT_UI,
})

// Colors
export const riskColors: Record<RiskLevel, string> = {
  low: '#00ff85',
  medium: '#f59e0b',
  high: '#ff5050',
}

export const content = css({
  flex: 1,
  overflow: 'auto',
})
