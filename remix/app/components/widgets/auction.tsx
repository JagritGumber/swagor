import type { Handle } from 'remix/ui'
import { css } from 'remix/ui'

import type { ReaderReadSuccess } from '../../types/reader.ts'
import {
  widgetStyle,
  widgetHeaderStyle,
  widgetContentStyle,
  dataRowStyle,
  sectionDividerStyle,
} from '../../constants/theme.ts'

interface AuctionWidgetProps {
  read: ReaderReadSuccess
}

export function AuctionWidget(handle: Handle<AuctionWidgetProps>) {
  const { read } = handle.props

  return () => (
    <div mix={widgetStyle}>
      <div mix={widgetHeaderStyle}>AUCTION</div>
      <div mix={widgetContentStyle}>
        <div mix={dataRowStyle}>
          <span>LOCATION:</span>
          <span>{read.auction.locationLabel}</span>
        </div>
        <div mix={dataRowStyle}>
          <span>BIAS:</span>
          <span
            mix={
              read.auction.bias === 'long'
                ? css({ color: '#3fb950' })
                : read.auction.bias === 'short'
                  ? css({ color: '#f85149' })
                  : undefined
            }
          >
            {read.auction.bias.toUpperCase()}
          </span>
        </div>
        {read.auction.profile && (
          <>
            <div mix={dataRowStyle}>
              <span>POC:</span>
              <span>${read.auction.profile.poc.toFixed(2)}</span>
            </div>
            <div mix={dataRowStyle}>
              <span>VA HIGH:</span>
              <span>${read.auction.profile.valueAreaHigh.toFixed(2)}</span>
            </div>
            <div mix={dataRowStyle}>
              <span>VA LOW:</span>
              <span>${read.auction.profile.valueAreaLow.toFixed(2)}</span>
            </div>
          </>
        )}
        <div mix={sectionDividerStyle}>{read.auction.narrative}</div>
      </div>
    </div>
  )
}
