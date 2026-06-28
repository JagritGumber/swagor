import type { Handle } from 'remix/ui'
import { css } from 'remix/ui'

import type { ReaderReadSuccess } from '../../types/reader.ts'
import { widget, FONT_DATA, TEXT_SECONDARY, TEXT_MUTED } from '../../constants/theme.ts'

interface PositionWidgetProps {
  read: ReaderReadSuccess
}

export function PositionWidget(handle: Handle<PositionWidgetProps>) {
  const { read } = handle.props

  return () => (
    <div mix={widget.base}>
      <div mix={widget.header}>POSITION</div>
      <div mix={widget.content}>
        <div mix={widget.row}>
          <span>ASSET</span>
          <span mix={css({ fontFamily: FONT_DATA })}>{read.asset}</span>
        </div>
        <div mix={widget.row}>
          <span>PRICE</span>
          <span mix={css({ fontFamily: FONT_DATA, fontWeight: 600 })}>${read.lastPrice.toFixed(2)}</span>
        </div>
        <div mix={widget.row}>
          <span>CANDLES</span>
          <span mix={css({ fontFamily: FONT_DATA })}>{read.candleCount}</span>
        </div>
        <div mix={widget.row}>
          <span>STATUS</span>
          <span mix={css({ fontFamily: FONT_DATA, color: TEXT_SECONDARY })}>WAITING</span>
        </div>
        <div mix={widget.row}>
          <span>ENTRY</span>
          <span mix={css({ fontFamily: FONT_DATA, color: TEXT_MUTED })}>-</span>
        </div>
        <div mix={widget.row}>
          <span>STOP</span>
          <span mix={css({ fontFamily: FONT_DATA, color: TEXT_MUTED })}>-</span>
        </div>
        <div mix={widget.row}>
          <span>TARGET</span>
          <span mix={css({ fontFamily: FONT_DATA, color: TEXT_MUTED })}>-</span>
        </div>
        <div mix={widget.divider}>{read.summary}</div>
      </div>
    </div>
  )
}
