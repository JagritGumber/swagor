import { createFileRoute, redirect } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { AgentView, type AgentViewProps } from '@/components/agent/view'

type AgentLoaderData = AgentViewProps

type AuthLoadResult =
  | { ok: true; data: AgentLoaderData }
  | { ok: false }

async function ensureXhrPolyfill(): Promise<void> {
  if (typeof globalThis.XMLHttpRequest !== 'undefined') return
  try {
    const mod = await import('xhr2')
    const XHR2 =
      (mod as { default?: typeof XMLHttpRequest }).default ??
      (mod as unknown as typeof XMLHttpRequest)
    globalThis.XMLHttpRequest = XHR2 as typeof XMLHttpRequest
  } catch {
    // Leave unset; buildAgentRead will fail and we fall back to empty shell.
  }
}

const loadAgent = createServerFn({ method: 'GET' })
  .validator((data: { href: string }) => data)
  .handler(async ({ data }): Promise<AuthLoadResult> => {
    const request = getRequest()
    const { getOptionalUser } = await import('@/lib/auth.ts')
    const user = await getOptionalUser(request)
    if (!user) return { ok: false }

    const url = new URL(data.href, 'http://local')
    const asset = (url.searchParams.get('asset') ?? 'ETH').toUpperCase()

    try {
      await ensureXhrPolyfill()
      const { buildAgentRead } = await import('@/server/build-agent-read')
      const result = await buildAgentRead(url)

      if (result.error) {
        console.error('[agent] buildAgentRead failed:', result.error)
        return {
          ok: true,
          data: {
            candles: [],
            segments: [],
            auction: null,
            regime: null,
            read: null,
            plan: null,
            asset,
          },
        }
      }

      return {
        ok: true,
        data: {
          candles: result.candles,
          segments: result.segments,
          auction: result.auction,
          regime: result.regime,
          read: result.read,
          plan: result.plan,
          asset: result.asset,
        },
      }
    } catch (err) {
      console.error('[agent] buildAgentRead failed:', err)
      return {
        ok: true,
        data: {
          candles: [],
          segments: [],
          auction: null,
          regime: null,
          read: null,
          plan: null,
          asset,
        },
      }
    }
  })

export const Route = createFileRoute('/agent')({
  head: () => ({
    meta: [
      { title: 'Selbo' },
      { name: 'color-scheme', content: 'dark' },
    ],
    links: [
      { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
      { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossOrigin: 'anonymous' },
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap',
      },
    ],
  }),
  loader: async ({ location }) => {
    const result = await loadAgent({ data: { href: location.href } })
    if (!result.ok) {
      throw redirect({ to: '/login' })
    }
    return result.data
  },
  component: AgentRoute,
})

function AgentRoute() {
  const data = Route.useLoaderData()
  return (
    <AgentView
      candles={data.candles}
      segments={data.segments}
      auction={data.auction}
      regime={data.regime}
      read={data.read}
      plan={data.plan}
      asset={data.asset}
    />
  )
}
