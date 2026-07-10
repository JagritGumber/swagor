import type { SelboReasoning } from '@/types/reader'

export interface ReasoningPanelProps {
  reasoning: SelboReasoning
}

export function ReasoningPanel({ reasoning }: ReasoningPanelProps) {
  const { intent, context, focus, confidence } = reasoning

  return (
    <div className="mx-6 flex gap-3 rounded-3xl border border-border-default border-l-[3px] border-l-accent-green bg-surface-widget px-4 py-3 shadow-[0_1px_3px_oklch(0_0_0_/_0.12)]">
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center justify-between">
          <span className="font-ui text-[11px] font-semibold tracking-[0.02em] text-text-primary">
            {intent}
          </span>
          <span className="rounded-[3px] bg-surface-widget-header px-1.5 py-0.5 font-data text-[9px] font-semibold uppercase tracking-[0.06em] text-accent-green">
            {confidence}
          </span>
        </div>
        <p className="m-0 mb-0.5 font-ui text-[11px] leading-normal text-text-secondary">
          {context}
        </p>
        <p className="m-0 font-ui text-[10px] italic leading-normal text-text-muted">
          Watching for: {focus}
        </p>
      </div>
    </div>
  )
}
