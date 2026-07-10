import type { ReaderReadSuccess } from '@/types/reader'

const widgetBase =
  'overflow-hidden rounded-3xl border border-border-default bg-surface-widget'
const widgetHeader =
  'border-b border-border-default bg-surface-widget-header px-gap-4 py-gap-2 font-ui text-[10px] font-semibold uppercase tracking-[0.08em] text-text-secondary'
const widgetContent = 'p-gap-4 font-ui text-xs leading-[1.6]'
const widgetRow = 'flex justify-between py-1 tabular-nums'
const widgetDivider =
  'mt-3 border-t border-border-default pt-3 text-[10px] leading-[1.5] text-text-muted'
const dataFont = 'font-data'

export interface RegimeWidgetProps {
  read: ReaderReadSuccess
}

export function RegimeWidget({ read }: RegimeWidgetProps) {
  return (
    <div className={widgetBase}>
      <div className={widgetHeader}>REGIME</div>
      <div className={widgetContent}>
        <div className={widgetRow}>
          <span>MODE</span>
          <span className={dataFont}>{read.regime.label}</span>
        </div>
        <div className={widgetRow}>
          <span>RANGE</span>
          <span
            className={[
              dataFont,
              read.regime.rangePct > 0.5 ? 'text-positive' : undefined,
            ]
              .filter(Boolean)
              .join(' ')}
          >
            {read.regime.rangePct}%
          </span>
        </div>
        <div className={widgetRow}>
          <span>DRIFT</span>
          <span
            className={[
              dataFont,
              read.regime.driftPct > 0.5
                ? 'text-positive'
                : read.regime.driftPct < -0.5
                  ? 'text-negative'
                  : undefined,
            ]
              .filter(Boolean)
              .join(' ')}
          >
            {read.regime.driftPct}%
          </span>
        </div>
        <div className={widgetRow}>
          <span>VOL</span>
          <span className={dataFont}>{read.regime.highVol ? 'YES' : 'NO'}</span>
        </div>
        <div className={widgetDivider}>{read.regime.reason}</div>
      </div>
    </div>
  )
}
