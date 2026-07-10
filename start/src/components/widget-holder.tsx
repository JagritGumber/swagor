import type { ReactNode } from 'react'

export interface WidgetDefinition {
  key: string
  render: () => ReactNode
}

export interface WidgetHolderProps {
  widgets: WidgetDefinition[]
  className?: string
}

export function WidgetHolder({ widgets, className }: WidgetHolderProps) {
  return (
    <div
      className={['grid grid-cols-3 gap-gap-4 p-gap-6', className].filter(Boolean).join(' ')}
    >
      {widgets.map((w) => (
        <div key={w.key}>{w.render()}</div>
      ))}
    </div>
  )
}
