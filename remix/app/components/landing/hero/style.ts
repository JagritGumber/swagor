import { css } from 'remix/ui'
import { FONT_UI, GAP_4, GAP_6, GAP_12 } from '../../../constants/theme.ts'

export const heroContainer = css({
  minHeight: '100vh',
  backgroundColor: '#0a0e14',
  color: '#ffffff',
  fontFamily: FONT_UI,
  overflow: 'hidden',
  position: 'relative',
})

export const nav = css({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '20px 96px',
})

export const navLogo = css({
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
})

export const logoText = css({
  fontSize: '24px',
  fontWeight: '700',
  letterSpacing: '-0.5px',
})

export const logoBadge = css({
  fontSize: '10px',
  fontWeight: '600',
  color: '#00d4ff',
  letterSpacing: '1.5px',
  padding: '4px 8px',
  border: '1px solid rgba(0, 212, 255, 0.3)',
  borderRadius: '4px',
})

export const navLinks = css({
  display: 'flex',
  alignItems: 'center',
  gap: '32px',
})

export const navLink = css({
  color: '#8892a4',
  textDecoration: 'none',
  fontSize: '14px',
  fontWeight: '500',
  transition: 'color 0.2s',
  ':hover': { color: '#ffffff' },
})

export const navCta = css({
  backgroundColor: '#00d4ff',
  color: '#0a0e14',
  padding: '12px 24px',
  borderRadius: '6px',
  textDecoration: 'none',
  fontSize: '14px',
  fontWeight: '600',
  transition: 'transform 0.2s, box-shadow 0.2s',
  ':hover': {
    transform: 'translateY(-1px)',
    boxShadow: '0 4px 12px rgba(0, 212, 255, 0.3)',
  },
})

export const heroSection = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '60px 96px 80px',
  gap: GAP_12,
})

export const heroContent = css({
  flex: '0 0 45%',
  maxWidth: '520px',
  display: 'flex',
  flexDirection: 'column',
  gap: GAP_12,
})

export const contentGroup = css({
  display: 'flex',
  flexDirection: 'column',
  gap: GAP_4,
})

export const actionGroup = css({
  display: 'flex',
  flexDirection: 'column',
  gap: GAP_4,
})

export const tagline = css({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '8px',
  padding: '8px 16px',
  border: '1px solid rgba(0, 212, 255, 0.3)',
  borderRadius: '24px',
  alignSelf: 'flex-start',
  fontSize: '11px',
  fontWeight: '600',
  letterSpacing: '1.5px',
  color: '#8892a4',
})

export const taglineDot = css({
  color: '#8892a4',
})

export const taglineText = css({
  color: '#00d4ff',
})

export const heroTitle = css({
  fontSize: '48px',
  fontWeight: '700',
  lineHeight: '1.1',
  letterSpacing: '-1px',
  margin: 0,
})

export const heroHighlight = css({
  color: '#00d4ff',
})

export const heroDescription = css({
  fontSize: '16px',
  lineHeight: '1.6',
  color: '#8892a4',
  margin: 0,
})

export const heroActions = css({
  display: 'flex',
  gap: GAP_4,
})

export const primaryCta = css({
  backgroundColor: '#00d4ff',
  color: '#0a0e14',
  padding: '16px 32px',
  borderRadius: '6px',
  textDecoration: 'none',
  fontSize: '15px',
  fontWeight: '600',
  display: 'inline-flex',
  alignItems: 'center',
  gap: '8px',
  transition: 'transform 0.2s, box-shadow 0.2s',
  ':hover': {
    transform: 'translateY(-2px)',
    boxShadow: '0 8px 20px rgba(0, 212, 255, 0.4)',
  },
})

export const secondaryCta = css({
  backgroundColor: 'transparent',
  color: '#ffffff',
  padding: '16px 32px',
  borderRadius: '6px',
  outline: '1px solid rgba(255, 255, 255, 0.2)',
  textDecoration: 'none',
  fontSize: '15px',
  fontWeight: '600',
  display: 'inline-flex',
  alignItems: 'center',
  gap: '8px',
  transition: 'outline-color 0.2s',
  ':hover': { outlineColor: 'rgba(255, 255, 255, 0.4)' },
})

export const ctaArrow = css({
  fontSize: '18px',
})

export const trustIndicators = css({
  display: 'flex',
  alignItems: 'center',
  gap: GAP_6,
  fontSize: '13px',
  color: '#8892a4',
})

export const trustItem = css({
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
})

export const trustIcon = css({
  fontSize: '16px',
  color: '#00d4ff',
})

export const heroVisual = css({
  width: '700px',
  height: '500px',
  flexShrink: 0,
  maxHeight: 'calc(100vh - 180px)',
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundImage: 'radial-gradient(circle, rgba(0, 212, 255, 0.08) 1px, transparent 1px)',
  backgroundSize: '20px 20px',
})
