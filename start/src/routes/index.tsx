import { createFileRoute } from '@tanstack/react-router'
import { SelboEquityPage } from '@/components/portfolio/selbo-equity-page'
import { getSelboEquity } from '@/data/selbo-equity'
import type { SelboEquityData } from '@/data/selbo-equity'

export const Route = createFileRoute('/')({
  head: () => ({
    meta: [
      { title: 'Selbo - Portfolio' },
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
  loader: async () => {
    try {
      const data = await getSelboEquity()
      return { data }
    } catch (error) {
      console.error('[home] getSelboEquity failed:', error)
      return {
        data: {
          totalEquity: 0,
          dailyChange: 0,
          dailyChangePct: 0,
          equityCurve: [],
        } satisfies SelboEquityData,
      }
    }
  },
  component: PortfolioRoute,
})

function PortfolioRoute() {
  const { data } = Route.useLoaderData()
  return <SelboEquityPage data={data} />
}
