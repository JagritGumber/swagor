import type { ReactNode } from 'react'
import {
  Outlet,
  createRootRoute,
  HeadContent,
  Scripts,
  useRouterState,
} from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { Navbar } from '@/components/navigation/navbar'
import appCss from '../styles/app.css?url'

type NavUser = { address: string }

const getOptionalNavUser = createServerFn({ method: 'GET' }).handler(
  async (): Promise<NavUser | null> => {
    const request = getRequest()
    // Lazy auth import keeps session secret resolution on the request path.
    const { getOptionalUser } = await import('@/lib/auth.ts')
    const identity = await getOptionalUser(request)
    if (!identity) return null

    const first = identity.wallets[0]
    if (!first) return null
    if (!first.address) {
      throw new Error('getOptionalNavUser: wallet address missing on user identity')
    }
    return { address: first.address }
  },
)

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Selbo' },
    ],
    links: [
      { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
      { rel: 'stylesheet', href: appCss },
    ],
  }),
  loader: async () => {
    const user = await getOptionalNavUser()
    return { user }
  },
  component: RootComponent,
})

function RootComponent() {
  const { user } = Route.useLoaderData()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const hideLinks = pathname === '/login'

  return (
    <RootDocument>
      <Navbar user={user} currentPath={pathname} hideLinks={hideLinks} />
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
        <Outlet />
      </div>
    </RootDocument>
  )
}

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body className="m-0 flex h-screen flex-col overflow-hidden bg-surface-body text-text-primary">
        {children}
        <Scripts />
      </body>
    </html>
  )
}
