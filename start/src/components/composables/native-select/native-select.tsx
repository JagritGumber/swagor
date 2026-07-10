import type { ChangeEvent, ReactNode, SelectHTMLAttributes } from 'react'

export interface NativeSelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'children'> {
  value: string
  disabled?: boolean
  children?: ReactNode
  onChange?: (event: ChangeEvent<HTMLSelectElement>) => void
  className?: string
}

export interface NativeSelectOptionProps {
  value: string
  disabled?: boolean
  children?: ReactNode
}

export function NativeSelect({
  value,
  disabled,
  children,
  onChange,
  className,
  ...rest
}: NativeSelectProps) {
  return (
    <div className={['relative w-full h-full', className].filter(Boolean).join(' ')}>
      <select
        value={value}
        disabled={disabled}
        onChange={onChange}
        className="h-full w-full min-w-0 appearance-none rounded-none border-0 bg-transparent py-0 pl-gap-4 pr-6 text-[13px] font-medium font-ui text-[#f1f5f9] transition-colors duration-150 outline-none cursor-pointer hover:text-white hover:bg-white/5 focus-visible:text-white focus-visible:bg-white/5 [&_option]:bg-surface-body [&_option]:text-[#f1f5f9] [&_option]:px-3 [&_option]:py-2 [&_option:disabled]:opacity-40"
        {...rest}
      >
        {children}
      </select>
      <svg
        className="pointer-events-none absolute top-1/2 right-2.5 h-4 w-4 -translate-y-1/2 text-[#6b7280]"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
    </div>
  )
}

export function NativeSelectOption({ value, disabled, children }: NativeSelectOptionProps) {
  return (
    <option value={value} disabled={disabled}>
      {children}
    </option>
  )
}
