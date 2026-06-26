import type { Handle } from 'remix/ui'
import { css } from 'remix/ui'

import type { ReaderReadSuccess } from '../../types/reader.ts'
import { widget, FONT_DATA } from '../../constants/theme.ts'

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
            mix={css({ fontFamily: FONT_DATA, color: read.regime.rangePct > 0.5 ? 'oklch(0.62 0.19 145)' : undefined })}
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
                ? 'oklch(0.62 0.19 145)'
                : read.regime.driftPct < -0.5
                  ? 'oklch(0.55 0.2 30)'
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
