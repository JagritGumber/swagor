import { useEffect, useState } from 'react'
import { Button } from '@/components/composables/button'

export interface WalletAddressProps {
  address: string
}

export function WalletAddress({ address }: WalletAddressProps) {
  const [copied, setCopied] = useState(false)

  if (!address) {
    throw new Error('WalletAddress: address is required')
  }

  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(timer)
  }, [copied])

  const truncated = `${address.slice(0, 6)}...${address.slice(-4)}`

  return (
    <div className="mt-1 flex items-center gap-2">
      <button
        type="button"
        className="cursor-pointer border-0 bg-transparent p-0 font-data text-xs text-[#64748b] transition-colors duration-150 hover:text-[#94a3b8]"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(address)
            setCopied(true)
          } catch {
            // clipboard not available
          }
        }}
      >
        {copied ? 'Copied!' : truncated}
      </button>
      <Button
        variant="outline"
        size="sm"
        className="no-underline"
        onClick={() => {
          window.open(`https://faucet.circle.com?address=${address}`, '_blank', 'noopener')
        }}
      >
        Faucet
      </Button>
    </div>
  )
}
