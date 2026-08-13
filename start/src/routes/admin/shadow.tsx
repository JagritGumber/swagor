import { createFileRoute } from '@tanstack/react-router'
import { SignalsPanel } from '@/components/shadow/signals-panel'

export const Route = createFileRoute('/admin/shadow')({
  head: () => ({
    meta: [
      { title: 'Shadow Trader - Admin' },
      { name: 'color-scheme', content: 'dark' },
    ],
  }),
  component: ShadowAdmin,
})

function ShadowAdmin() {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-surface-body font-ui">
      <div className="border-b border-border-default bg-surface-panel px-6 py-3">
        <h1 className="text-sm font-medium text-text-primary">
          Shadow Trader
        </h1>
        <p className="mt-0.5 text-[11px] text-[#6b7280]">
          Live signal feed from Binance BTC/USDT websocket
        </p>
      </div>
      <div className="flex-1 overflow-hidden">
        <SignalsPanel />
      </div>
    </div>
  )
}
