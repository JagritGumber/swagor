import { css } from 'remix/ui'
import { FONT_UI, FONT_DATA, SURFACE_BODY } from '../../constants/theme.ts'

export const landingPage = css({
  backgroundColor: SURFACE_BODY,
  color: '#ffffff',
  fontFamily: FONT_UI,
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
})

export const chartArea = css({
  flex: 1,
  position: 'relative',
  minHeight: 0,
  display: 'flex',
  flexDirection: 'column',
})

export const bottomStrip = css({
  height: '180px',
  borderTop: '1px solid rgba(255, 255, 255, 0.06)',
  overflow: 'hidden',
})

export const analysisPanel = css({
  position: 'absolute',
  top: 0,
  right: 0,
  width: '320px',
  height: '100%',
  backgroundColor: 'rgba(10, 14, 20, 0.95)',
  borderLeft: '1px solid rgba(255, 255, 255, 0.06)',
  padding: '24px',
  display: 'flex',
  flexDirection: 'column',
  gap: '20px',
  transform: 'translateX(100%)',
  transition: 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
  zIndex: 10,
  overflowY: 'auto',
})

export const analysisPanelOpen = css({
  transform: 'translateX(0)',
})

export const analysisSection = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
})

export const analysisLabel = css({
  fontSize: '11px',
  fontWeight: '600',
  letterSpacing: '1px',
  color: '#8892a4',
  textTransform: 'uppercase',
})

export const analysisValue = css({
  fontSize: '14px',
  lineHeight: '1.5',
  color: '#ffffff',
})

export const analysisNarrative = css({
  fontSize: '13px',
  lineHeight: '1.6',
  color: '#8892a4',
})

export const regimeBadge = css({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  padding: '4px 10px',
  borderRadius: '4px',
  fontSize: '12px',
  fontWeight: '600',
  fontFamily: FONT_DATA,
})

export const regimeRange = css({
  backgroundColor: 'rgba(136, 146, 164, 0.15)',
  color: '#8892a4',
})

export const regimeTrendUp = css({
  backgroundColor: 'rgba(0, 212, 100, 0.15)',
  color: '#00d464',
})

export const regimeTrendDown = css({
  backgroundColor: 'rgba(255, 80, 80, 0.15)',
  color: '#ff5050',
})

export const regimeHighVol = css({
  backgroundColor: 'rgba(255, 180, 0, 0.15)',
  color: '#ffb400',
})

export const tradeLogHeader = css({
  display: 'grid',
  gridTemplateColumns: '100px 60px 1fr 1fr 80px 2fr',
  gap: '12px',
  padding: '12px 24px',
  borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
  fontSize: '11px',
  fontWeight: '600',
  letterSpacing: '1px',
  color: '#8892a4',
  textTransform: 'uppercase',
  fontFamily: FONT_DATA,
})

export const tradeLogRow = css({
  display: 'grid',
  gridTemplateColumns: '100px 60px 1fr 1fr 80px 2fr',
  gap: '12px',
  padding: '10px 24px',
  borderBottom: '1px solid rgba(255, 255, 255, 0.03)',
  fontSize: '13px',
  fontFamily: FONT_DATA,
  cursor: 'pointer',
  transition: 'background-color 0.15s',
  ':hover': {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
})

export const tradeLogEmpty = css({
  padding: '40px 24px',
  textAlign: 'center',
  fontSize: '13px',
  color: '#8892a4',
})

export const sideLong = css({ color: '#00d464' })
export const sideShort = css({ color: '#ff5050' })
export const rPositive = css({ color: '#00d464' })
export const rNegative = css({ color: '#ff5050' })

export const stanceBadge = css({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  padding: '4px 10px',
  borderRadius: '4px',
  fontSize: '12px',
  fontWeight: '600',
  fontFamily: FONT_DATA,
})

export const stanceWait = css({
  backgroundColor: 'rgba(136, 146, 164, 0.15)',
  color: '#8892a4',
})

export const stancePossibleLong = css({
  backgroundColor: 'rgba(0, 212, 100, 0.2)',
  color: '#00d464',
})

export const stancePossibleShort = css({
  backgroundColor: 'rgba(255, 80, 80, 0.2)',
  color: '#ff5050',
})

export const stanceWatchLong = css({
  backgroundColor: 'rgba(0, 212, 100, 0.1)',
  color: '#00d464',
})

export const stanceWatchShort = css({
  backgroundColor: 'rgba(255, 80, 80, 0.1)',
  color: '#ff5050',
})

export const stanceAvoid = css({
  backgroundColor: 'rgba(255, 180, 0, 0.15)',
  color: '#ffb400',
})

export const planStatus = css({
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
})

export const planBadge = css({
  display: 'inline-flex',
  alignItems: 'center',
  padding: '2px 8px',
  borderRadius: '3px',
  fontSize: '11px',
  fontWeight: '700',
  fontFamily: FONT_DATA,
  letterSpacing: '0.5px',
})

export const planLong = css({
  backgroundColor: 'rgba(0, 212, 100, 0.2)',
  color: '#00d464',
})

export const planShort = css({
  backgroundColor: 'rgba(255, 80, 80, 0.2)',
  color: '#ff5050',
})

export const planStatusLabel = css({
  fontSize: '13px',
  fontWeight: '500',
  color: '#ffffff',
})

export const planLevels = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
  marginTop: '4px',
})

export const planLevel = css({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
})

export const planLevelLabel = css({
  fontSize: '11px',
  color: '#8892a4',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
})

export const planLevelValue = css({
  fontSize: '12px',
  fontFamily: FONT_DATA,
  color: '#ffffff',
})

export const planStop = css({
  color: '#ff5050',
})

export const planTarget = css({
  color: '#00d464',
})

export const planConfidence = css({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginTop: '4px',
  paddingTop: '8px',
  borderTop: '1px solid rgba(255, 255, 255, 0.06)',
})

export const planConfidenceLabel = css({
  fontSize: '11px',
  color: '#8892a4',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
})

export const planConfidenceValue = css({
  fontSize: '12px',
  fontFamily: FONT_DATA,
  color: '#ffffff',
})

export const orderflowRow = css({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
})

export const orderflowLabel = css({
  fontSize: '11px',
  color: '#8892a4',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
})

export const orderflowValue = css({
  fontSize: '12px',
  fontFamily: FONT_DATA,
  color: '#ffffff',
})

export const orderflowBuy = css({
  color: '#00d464',
})

export const orderflowSell = css({
  color: '#ff5050',
})
