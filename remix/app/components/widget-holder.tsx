import type { Handle, RemixNode } from 'remix/ui'
import { css } from 'remix/ui'

interface WidgetDefinition {
  key: string
  render: () => RemixNode
}

interface WidgetHolderProps {
  widgets: WidgetDefinition[]
}

export function WidgetHolder(handle: Handle<WidgetHolderProps>) {
  const { widgets } = handle.props

  return () => (
    <div
      mix={css({
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '12px',
        padding: '16px',
      })}
    >
      {widgets.map((w) => (
        <div key={w.key}>{w.render()}</div>
      ))}
    </div>
  )
}
