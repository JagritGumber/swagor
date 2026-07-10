import type { RemixNode, SerializableProps } from 'remix/ui'

export interface TooltipProps extends SerializableProps {
  content: string
  children?: RemixNode
}
