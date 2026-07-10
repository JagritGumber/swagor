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

export interface PositionWidgetProps {
  read: ReaderReadSuccess
}

export function PositionWidget({ read }: PositionWidgetProps) {
  return (
    <div className={widgetBase}>
      <div className={widgetHeader}>POSITION</div>
      <div className={widgetContent}>
        <div className={widgetRow}>
          <span>ASSET</span>
          <span className={dataFont}>{read.asset}</span>
        </div>
        <div className={widgetRow}>
          <span>PRICE</span>
          <span className={`${dataFont} font-semibold`}>${read.lastPrice.toFixed(2)}</span>
        </div>
        <div className={widgetRow}>
          <span>CANDLES</span>
          <span className={dataFont}>{read.candleCount}</span>
        </div>
        <div className={widgetRow}>
          <span>STATUS</span>
          <span className={`${dataFont} text-text-secondary`}>WAITING</span>
        </div>
        <div className={widgetRow}>
          <span>ENTRY</span>
          <span className={`${dataFont} text-text-muted`}>-</span>
        </div>
        <div className={widgetRow}>
          <span>STOP</span>
          <span className={`${dataFont} text-text-muted`}>-</span>
        </div>
        <div className={widgetRow}>
          <span>TARGET</span>
          <span className={`${dataFont} text-text-muted`}>-</span>
        </div>
        <div className={widgetDivider}>{read.summary}</div>
      </div>
    </div>
  )
}
