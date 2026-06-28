import type { Handle } from 'remix/ui'
import { css } from 'remix/ui'

import type { SelboReasoning } from '../../types/reader.ts'
import {
  FONT_UI,
  FONT_DATA,
  SURFACE_WIDGET,
  SURFACE_WIDGET_HEADER,
  BORDER_DEFAULT,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  TEXT_MUTED,
  ACCENT_GREEN,
} from '../../constants/theme.ts'

interface ReasoningPanelProps {
  reasoning: SelboReasoning
}

const panelStyle = css({
  display: 'flex',
  margin: '0 24px',
  padding: '12px 16px',
  background: SURFACE_WIDGET,
  border: `1px solid ${BORDER_DEFAULT}`,
  borderLeft: `3px solid ${ACCENT_GREEN}`,
  borderRadius: '24px',
  boxShadow: '0 1px 3px oklch(0 0 0 / 0.12)',
  gap: '12px',
})

const contentStyle = css({
  flex: 1,
  minWidth: 0,
})

const headerStyle = css({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '4px',
})

const intentStyle = css({
  fontFamily: FONT_UI,
  fontSize: '11px',
  fontWeight: 600,
  color: TEXT_PRIMARY,
  letterSpacing: '0.02em',
})

const badgeStyle = css({
  fontFamily: FONT_DATA,
  fontSize: '9px',
  fontWeight: 600,
  color: ACCENT_GREEN,
  background: SURFACE_WIDGET_HEADER,
  padding: '2px 6px',
  borderRadius: '3px',
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
})

const contextStyle = css({
  fontFamily: FONT_UI,
  fontSize: '11px',
  lineHeight: 1.5,
  color: TEXT_SECONDARY,
  margin: 0,
  marginBottom: '2px',
})

const focusStyle = css({
  fontFamily: FONT_UI,
  fontSize: '10px',
  lineHeight: 1.5,
  color: TEXT_MUTED,
  fontStyle: 'italic',
  margin: 0,
})

export function ReasoningPanel(handle: Handle<ReasoningPanelProps>) {
  const { intent, context, focus, confidence } = handle.props.reasoning

  return () => (
    <div mix={panelStyle}>
      <div mix={contentStyle}>
        <div mix={headerStyle}>
          <span mix={intentStyle}>{intent}</span>
          <span mix={badgeStyle}>{confidence}</span>
        </div>
        <p mix={contextStyle}>{context}</p>
        <p mix={focusStyle}>Watching for: {focus}</p>
      </div>
    </div>
  )
}
