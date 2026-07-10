import { css } from 'remix/ui'
import { FONT_UI } from '../../../constants/theme.ts'

export const selectWrapper = css({
  position: 'relative',
  width: '100%',
  height: '100%',
})

export const select = css({
  height: '100%',
  width: '100%',
  minWidth: 0,
  appearance: 'none',
  borderRadius: 0,
  border: 'none',
  background: 'transparent',
  padding: '0 24px 0 16px',
  fontSize: '13px',
  fontWeight: 500,
  fontFamily: FONT_UI,
  color: '#f1f5f9',
  transition: 'color 0.15s',
  outline: 'none',
  cursor: 'pointer',
  '&:hover': { color: '#ffffff', background: 'rgba(255, 255, 255, 0.05)' },
  '&:focus-visible': { color: '#ffffff', background: 'rgba(255, 255, 255, 0.05)' },
  '& option': { background: '#0a0e14', color: '#f1f5f9', padding: '8px 12px' },
  '& option:disabled': { opacity: 0.4 },
})

export const chevron = css({
  position: 'absolute',
  top: '50%',
  right: '10px',
  transform: 'translateY(-50%)',
  pointerEvents: 'none',
  color: '#6b7280',
  width: '16px',
  height: '16px',
})
