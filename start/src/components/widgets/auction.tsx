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

export interface AuctionWidgetProps {
  read: ReaderReadSuccess
}

export function AuctionWidget({ read }: AuctionWidgetProps) {
  return (
    <div className={widgetBase}>
      <div className={widgetHeader}>AUCTION</div>
      <div className={widgetContent}>
        <div className={widgetRow}>
          <span>LOCATION</span>
          <span className={dataFont}>{read.auction.locationLabel}</span>
        </div>
        <div className={widgetRow}>
          <span>BIAS</span>
          <span
            className={[
              dataFont,
              'font-semibold',
              read.auction.bias === 'long'
                ? 'text-positive'
                : read.auction.bias === 'short'
                  ? 'text-negative'
                  : undefined,
            ]
              .filter(Boolean)
              .join(' ')}
          >
            {read.auction.bias.toUpperCase()}
          </span>
        </div>
        {read.auction.profile ? (
          <>
            <div className={widgetRow}>
              <span>POC</span>
              <span className={dataFont}>${read.auction.profile.poc.toFixed(2)}</span>
            </div>
            <div className={widgetRow}>
              <span>VA HIGH</span>
              <span className={dataFont}>${read.auction.profile.valueAreaHigh.toFixed(2)}</span>
            </div>
            <div className={widgetRow}>
              <span>VA LOW</span>
              <span className={dataFont}>${read.auction.profile.valueAreaLow.toFixed(2)}</span>
            </div>
          </>
        ) : null}
        <div className={widgetDivider}>{read.auction.narrative}</div>
      </div>
    </div>
  )
}
