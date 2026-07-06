import type { Handle, RemixNode } from 'remix/ui'
import { css } from 'remix/ui'

import { routes } from './routes.ts'
import { Navbar } from './components/navbar.tsx'

export interface DocumentProps {
  children?: RemixNode
  head?: RemixNode
  title?: string
  hideNav?: boolean
  hideNavLinks?: boolean
  user?: { address: string }
  currentPath?: string
  publicRoute?: boolean
}

const DEFAULT_TITLE = readAppDisplayName('Remix')

export function Document(handle: Handle<DocumentProps>) {
  return () => {
    let { children, head, title = DEFAULT_TITLE, hideNav, hideNavLinks, user, currentPath, publicRoute } = handle.props

    return (
      <html lang="en">
        <head>
          <meta charSet="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
          <title>{title}</title>
          {head}
        </head>
          <body mix={css({ margin: 0, display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', background: '#0a0e14' })}>
          {!hideNav && <Navbar user={user} hideLinks={hideNavLinks} currentPath={currentPath} publicRoute={publicRoute} />}
          <div mix={css({ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' })}>
            {children}
          </div>
          <script type="module" src={routes.assets.href({ path: 'app/assets/entry.ts' })}></script>
        </body>
      </html>
    )
  }
}

function readAppDisplayName(value: string): string {
  return value.startsWith('%%') ? 'Remix App' : decodeURIComponent(value)
}
