import type { Handle } from 'remix/ui'
import { css } from 'remix/ui'

import type { ReaderReadSuccess } from '@/types/reader'
import { widget, FONT_DATA, POSITIVE, NEGATIVE } from '@/constants/theme'

interface RegimeWidgetProps {
  read: ReaderReadSuccess
}

export function RegimeWidget(handle: Handle<RegimeWidgetProps>) {
  const { read } = handle.props

  return () => (
    <div mix={widget.base}>
      <div mix={widget.header}>REGIME</div>
      <div mix={widget.content}>
        <div mix={widget.row}>
          <span>MODE</span>
          <span mix={css({ fontFamily: FONT_DATA })}>{read.regime.label}</span>
        </div>
        <div mix={widget.row}>
          <span>RANGE</span>
          <span
            mix={css({ fontFamily: FONT_DATA,           color: read.regime.rangePct > 0.5 ? POSITIVE : undefined })}
          >
            {read.regime.rangePct}%
          </span>
        </div>
        <div mix={widget.row}>
          <span>DRIFT</span>
          <span
            mix={css({
              fontFamily: FONT_DATA,
              color: read.regime.driftPct > 0.5
                ? POSITIVE
                : read.regime.driftPct < -0.5
                  ? NEGATIVE
                  : undefined,
            })}
          >
            {read.regime.driftPct}%
          </span>
        </div>
        <div mix={widget.row}>
          <span>VOL</span>
          <span mix={css({ fontFamily: FONT_DATA })}>{read.regime.highVol ? 'YES' : 'NO'}</span>
        </div>
        <div mix={widget.divider}>{read.regime.reason}</div>
      </div>
    </div>
  )
}
