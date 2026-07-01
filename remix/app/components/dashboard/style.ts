import { css } from 'remix/ui'

export const shell = css({
  display: 'flex',
  flexDirection: 'column',
  height: '100vh',
  overflow: 'hidden',
})

export const content = css({
  flex: 1,
  minHeight: 0,
  display: 'flex',
  flexDirection: 'column',
})
