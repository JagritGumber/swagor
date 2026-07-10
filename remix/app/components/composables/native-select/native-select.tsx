import type { Handle, RemixNode } from 'remix/ui'
import { selectWrapper, select, chevron } from './styles.ts'

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
