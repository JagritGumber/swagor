import { clientEntry, css, type Handle, type SerializableProps } from 'remix/ui'
import { fetchBalance } from '../data/api.ts'

interface BalanceProps extends SerializableProps {
  initialBalance: number
}

export const BalanceDisplay = clientEntry(
  import.meta.url,
  function BalanceDisplay(handle: Handle<BalanceProps>) {
    let balance = handle.props.initialBalance
    let polling = false
    let hydrated = false

    return () => {
      if (typeof window !== 'undefined' && !hydrated) {
        hydrated = true
        queueMicrotask(() => {
          startPolling()
        })
      }

      function startPolling() {
        if (polling) return
        polling = true

        const interval = setInterval(async () => {
          try {
            const res = await fetchBalance()
            if (res.ok) {
              balance = res.data.balanceUsd
              handle.update()
            }
          } catch {
            // keep last known balance
          }
        }, 60_000)

        handle.signal.addEventListener('abort', () => clearInterval(interval))
      }

      return (
        <span
          mix={css({
            fontVariantNumeric: 'tabular-nums',
          })}
        >
          ${balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      )
    }
  },
)
