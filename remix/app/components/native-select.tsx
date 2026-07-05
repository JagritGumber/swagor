// Native select component — styled like shadcn/ui
import type { Handle, RemixNode } from 'remix/ui'
import { css } from 'remix/ui'
import { FONT_UI } from '../constants/theme.ts'

const selectWrapper = css({
  position: 'relative',
  width: '100%',
  height: '100%',
})

const select = css({
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
  '&:hover': { color: '#ffffff' },
  '&:focus-visible': { color: '#ffffff' },
  '& option': { background: '#0a0e14', color: '#f1f5f9', padding: '8px 12px' },
  '& option:disabled': { opacity: 0.4 },
})

const chevron = css({
  position: 'absolute',
  top: '50%',
  right: '10px',
  transform: 'translateY(-50%)',
  pointerEvents: 'none',
  color: '#6b7280',
  width: '16px',
  height: '16px',
})

export function NativeSelect(handle: Handle<{ value: string; disabled?: boolean; children?: RemixNode }>) {
  return () => {
    const { value, disabled, children } = handle.props
    return (
      <div mix={selectWrapper}>
        <select mix={select} value={value} disabled={disabled}>
          {children}
        </select>
        <svg mix={chevron} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </div>
    )
  }
}

export function NativeSelectOption(handle: Handle<{ value: string; disabled?: boolean; children?: RemixNode }>) {
  return () => (
    <option value={handle.props.value} disabled={handle.props.disabled}>
      {handle.props.children}
    </option>
  )
}
