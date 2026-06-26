import type { Handle } from 'remix/ui'

import type { ReaderReadSuccess } from '../../types/reader.ts'
import {
  widgetStyle,
  widgetHeaderStyle,
  widgetContentStyle,
  dataRowStyle,
  sectionDividerStyle,
} from '../../constants/theme.ts'

interface PositionWidgetProps {
  read: ReaderReadSuccess
}

export function PositionWidget(handle: Handle<PositionWidgetProps>) {
  const { read } = handle.props

  return () => (
    <div mix={widgetStyle}>
      <div mix={widgetHeaderStyle}>POSITION</div>
      <div mix={widgetContentStyle}>
        <div mix={dataRowStyle}>
          <span>ASSET:</span>
          <span>{read.asset}</span>
        </div>
        <div mix={dataRowStyle}>
          <span>PRICE:</span>
          <span>${read.lastPrice.toFixed(2)}</span>
        </div>
        <div mix={dataRowStyle}>
          <span>CANDLES:</span>
          <span>{read.candleCount}</span>
        </div>
        <div mix={dataRowStyle}>
          <span>STATUS:</span>
          <span>WAITING</span>
        </div>
        <div mix={dataRowStyle}>
          <span>ENTRY:</span>
          <span>-</span>
        </div>
        <div mix={dataRowStyle}>
          <span>STOP:</span>
          <span>-</span>
        </div>
        <div mix={dataRowStyle}>
          <span>TARGET:</span>
          <span>-</span>
        </div>
        <div mix={sectionDividerStyle}>{read.summary}</div>
      </div>
    </div>
  )
}
