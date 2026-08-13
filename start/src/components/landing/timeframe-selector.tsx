import { INTERVALS } from '@/data/intervals'

interface TimeframeSelectorProps {
  active: string
  onChange: (interval: string) => void
}

export function TimeframeSelector({ active, onChange }: TimeframeSelectorProps) {
  return (
    <div className="flex items-center gap-0.5">
      {INTERVALS.map((iv) => (
        <button
          key={iv}
          onClick={() => onChange(iv)}
          className={`px-2 py-0.5 text-[11px] font-medium rounded transition-[transform,background-color,color] duration-150 scale-100 active:scale-95 ${
            active === iv
              ? 'text-white'
              : 'text-[#6b7280] hover:text-[#9ca3af]'
          }`}
        >
          {iv}
        </button>
      ))}
    </div>
  )
}
