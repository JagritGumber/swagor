import { useEffect, useState } from 'react'
import { fetchBalance } from '@/data/api'

export interface BalanceDisplayProps {
  initialBalance: number
}

export function BalanceDisplay({ initialBalance }: BalanceDisplayProps) {
  const [balance, setBalance] = useState(initialBalance)

  useEffect(() => {
    setBalance(initialBalance)
  }, [initialBalance])

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetchBalance()
        if (res.ok) {
          setBalance(res.data.balanceUsd)
        }
      } catch {
        // keep last known balance
      }
    }, 60_000)

    return () => clearInterval(interval)
  }, [])

  return (
    <span className="tabular-nums">
      $
      {balance.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}
    </span>
  )
}
