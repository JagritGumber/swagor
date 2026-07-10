import { css } from 'remix/ui'
import { FONT_UI } from '../../../constants/theme.ts'

export const overlay = css({
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.7)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
})

export const modalBox = css({
  backgroundColor: '#1a1a1a',
  border: '1px solid rgba(255, 255, 255, 0.10)',
  borderRadius: '12px',
  padding: '24px',
  maxWidth: '400px',
  width: '100%',
  fontFamily: FONT_UI,
})

export const modalTitle = css({
  fontSize: '18px',
  fontWeight: 600,
  color: '#f1f5f9',
  marginBottom: '8px',
})

export const modalMessage = css({
  fontSize: '14px',
  fontWeight: 400,
  color: '#94a3b8',
  marginBottom: '24px',
  lineHeight: 1.5,
})

export const buttonRow = css({
  display: 'flex',
  gap: '12px',
  justifyContent: 'flex-end',
})

export const cancelBtn = css({
  appearance: 'none',
  border: '1px solid rgba(255, 255, 255, 0.10)',
  borderRadius: '8px',
  background: 'transparent',
  color: '#94a3b8',
  fontFamily: FONT_UI,
  fontSize: '14px',
  fontWeight: 500,
  padding: '8px 16px',
  cursor: 'pointer',
  transition: 'color 0.15s, border-color 0.15s',
  '&:hover': { color: '#f1f5f9', borderColor: 'rgba(255, 255, 255, 0.20)' },
})

export const confirmBtn = css({
  appearance: 'none',
  border: 'none',
  borderRadius: '8px',
  fontFamily: FONT_UI,
  fontSize: '14px',
  fontWeight: 600,
  padding: '8px 16px',
  cursor: 'pointer',
  transition: 'opacity 0.15s',
  '&:hover': { opacity: 0.85 },
  backgroundColor: '#ff5050',
  color: '#ffffff',
})
