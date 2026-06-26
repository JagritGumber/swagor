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

interface RegimeWidgetProps {
  read: ReaderReadSuccess
}

export function RegimeWidget(handle: Handle<RegimeWidgetProps>) {
  const { read } = handle.props

  return () => (
    <div mix={widgetStyle}>
      <div mix={widgetHeaderStyle}>REGIME</div>
      <div mix={widgetContentStyle}>
        <div mix={dataRowStyle}>
          <span>MODE:</span>
          <span>{read.regime.label}</span>
        </div>
        <div mix={dataRowStyle}>
          <span>RANGE:</span>
          <span mix={read.regime.rangePct > 0.5 ? css({ color: '#3fb950' }) : undefined}>
            {read.regime.rangePct}%
          </span>
        </div>
        <div mix={dataRowStyle}>
          <span>DRIFT:</span>
          <span
            mix={
              read.regime.driftPct > 0.5
                ? css({ color: '#3fb950' })
                : read.regime.driftPct < -0.5
                  ? css({ color: '#f85149' })
                  : undefined
            }
          >
            {read.regime.driftPct}%
          </span>
        </div>
        <div mix={dataRowStyle}>
          <span>VOL:</span>
          <span>{read.regime.highVol ? 'YES' : 'NO'}</span>
        </div>
        <div mix={sectionDividerStyle}>{read.regime.reason}</div>
      </div>
    </div>
  )
}
