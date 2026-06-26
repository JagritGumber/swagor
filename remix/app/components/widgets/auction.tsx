import type { Handle } from 'remix/ui'
import { css } from 'remix/ui'

import type { ReaderReadSuccess } from '../../types/reader.ts'
import { widget, FONT_DATA } from '../../constants/theme.ts'

interface AuctionWidgetProps {
  read: ReaderReadSuccess
}

export function AuctionWidget(handle: Handle<AuctionWidgetProps>) {
  const { read } = handle.props

  return () => (
    <div mix={widget.base}>
      <div mix={widget.header}>AUCTION</div>
      <div mix={widget.content}>
        <div mix={widget.row}>
          <span>LOCATION</span>
          <span mix={css({ fontFamily: FONT_DATA })}>{read.auction.locationLabel}</span>
        </div>
        <div mix={widget.row}>
          <span>BIAS</span>
          <span
            mix={css({
              fontFamily: FONT_DATA,
              fontWeight: 600,
              color: read.auction.bias === 'long'
                ? 'oklch(0.62 0.19 145)'
                : read.auction.bias === 'short'
                  ? 'oklch(0.55 0.2 30)'
                  : undefined,
            })}
          >
            {read.auction.bias.toUpperCase()}
          </span>
        </div>
        {read.auction.profile && (
          <>
            <div mix={widget.row}>
              <span>POC</span>
              <span mix={css({ fontFamily: FONT_DATA })}>${read.auction.profile.poc.toFixed(2)}</span>
            </div>
            <div mix={widget.row}>
              <span>VA HIGH</span>
              <span mix={css({ fontFamily: FONT_DATA })}>${read.auction.profile.valueAreaHigh.toFixed(2)}</span>
            </div>
            <div mix={widget.row}>
              <span>VA LOW</span>
              <span mix={css({ fontFamily: FONT_DATA })}>${read.auction.profile.valueAreaLow.toFixed(2)}</span>
            </div>
          </>
        )}
        <div mix={widget.divider}>{read.auction.narrative}</div>
      </div>
    </div>
  )
}
