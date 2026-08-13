import type { Candle } from '@shared/candle'

interface AssetHeaderProps {
  asset: string
  candles: Candle[]
  marketCap?: number | null
  fundingRate?: number | null
  openInterest?: number | null
}

function AssetIcon({ asset }: { asset: string }) {
  switch (asset) {
    case 'BTC':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" className="h-7 w-7">
          <g fill="none" fillRule="evenodd">
            <circle cx="16" cy="16" r="16" fill="#F7931A" />
            <path fill="#FFF" fillRule="nonzero" d="M23.189 14.02c.314-2.096-1.283-3.223-3.465-3.975l.708-2.84-1.728-.43-.69 2.765c-.454-.114-.92-.22-1.385-.326l.695-2.783L15.596 6l-.708 2.839c-.376-.086-.746-.17-1.104-.26l.002-.009-2.384-.595-.46 1.846s1.283.294 1.256.312c.7.175.826.638.805 1.006l-.806 3.235c.048.012.11.03.18.057l-.183-.045-1.13 4.532c-.086.212-.303.531-.793.41.018.025-1.256-.313-1.256-.313l-.858 1.978 2.25.561c.418.105.828.215 1.231.318l-.715 2.872 1.727.43.708-2.84c.472.127.93.245 1.378.357l-.706 2.828 1.728.43.715-2.866c2.948.558 5.164.333 6.097-2.333.752-2.146-.037-3.385-1.588-4.192 1.13-.26 1.98-1.003 2.207-2.538zm-3.95 5.538c-.533 2.147-4.148.986-5.32.695l.95-3.805c1.172.293 4.929.872 4.37 3.11zm.535-5.569c-.487 1.953-3.495.96-4.47.717l.86-3.45c.975.243 4.118.696 3.61 2.733z" />
          </g>
        </svg>
      )
    case 'ETH':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" className="h-7 w-7">
          <g fill="none" fillRule="evenodd">
            <circle cx="16" cy="16" r="16" fill="#627EEA" />
            <g fill="#FFF" fillRule="nonzero">
              <path fillOpacity=".602" d="M16.498 4v8.87l7.497 3.35z" />
              <path d="M16.498 4L9 16.22l7.498-3.35z" />
              <path fillOpacity=".602" d="M16.498 21.968v6.027L24 17.616z" />
              <path d="M16.498 27.995v-6.028L9 17.616z" />
              <path fillOpacity=".2" d="M16.498 20.573l7.497-4.353-7.497-3.348z" />
              <path fillOpacity=".602" d="M9 16.22l7.498 4.353v-7.701z" />
            </g>
          </g>
        </svg>
      )
    case 'SOL':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" className="h-7 w-7">
          <g fill="none">
            <circle fill="#66F9A1" cx="16" cy="16" r="16" />
            <path d="M9.925 19.687a.59.59 0 01.415-.17h14.366a.29.29 0 01.207.497l-2.838 2.815a.59.59 0 01-.415.171H7.294a.291.291 0 01-.207-.498l2.838-2.815zm0-10.517A.59.59 0 0110.34 9h14.366c.261 0 .392.314.207.498l-2.838 2.815a.59.59 0 01-.415.17H7.294a.291.291 0 01-.207-.497L9.925 9.17zm12.15 5.225a.59.59 0 00-.415-.17H7.294a.291.291 0 00-.207.498l2.838 2.815c.11.109.26.17.415.17h14.366a.291.291 0 00.207-.498l-2.838-2.815z" fill="#FFF" />
          </g>
        </svg>
      )
    case 'DOGE':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" className="h-7 w-7">
          <g fill="none" fillRule="evenodd">
            <circle cx="16" cy="16" r="16" fill="#C3A634" />
            <path fill="#FFF" d="M13.248 14.61h4.314v2.286h-4.314v4.818h2.721c1.077 0 1.958-.145 2.644-.437.686-.291 1.224-.694 1.615-1.21a4.4 4.4 0 00.796-1.815 11.4 11.4 0 00.21-2.252 11.4 11.4 0 00-.21-2.252 4.396 4.396 0 00-.796-1.815c-.391-.516-.93-.919-1.615-1.21-.686-.292-1.567-.437-2.644-.437h-2.721v4.325zm-2.766 2.286H9v-2.285h1.482V8h6.549c1.21 0 2.257.21 3.142.627.885.419 1.607.99 2.168 1.715.56.724.977 1.572 1.25 2.543.273.971.409 2.01.409 3.115a11.47 11.47 0 01-.41 3.115c-.272.97-.689 1.819-1.25 2.543-.56.725-1.282 1.296-2.167 1.715-.885.418-1.933.627-3.142.627h-6.549v-7.104z" />
          </g>
        </svg>
      )
    case 'AVAX':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" className="h-7 w-7">
          <g fill="none" fillRule="evenodd">
            <circle fill="#E84142" fillRule="nonzero" cx="16" cy="16" r="16" />
            <path d="M11.518 22.75H8.49c-.636 0-.95 0-1.142-.123A.77.77 0 017 22.025c-.012-.226.145-.503.46-1.055l7.472-13.193c.318-.56.48-.84.682-.944a.77.77 0 01.698 0c.203.104.364.384.682.944l1.536 2.686.008.014c.343.6.517.906.593 1.226a2.26 2.26 0 010 1.066c-.076.323-.249.63-.597 1.24l-3.926 6.95-.01.017c-.346.606-.52.913-.764 1.145a2.284 2.284 0 01-.93.54c-.319.089-.675.089-1.387.089zm7.643 0h4.336c.64 0 .962 0 1.154-.126a.768.768 0 00.348-.607c.011-.219-.142-.484-.443-1.005l-.032-.054-2.172-3.722-.025-.042c-.305-.517-.46-.778-.657-.879a.762.762 0 00-.693 0c-.2.104-.36.377-.678.925l-2.165 3.722-.007.013c-.317.548-.476.821-.464 1.046a.777.777 0 00.348.606c.188.123.51.123 1.15.123z" fill="#FFF" />
          </g>
        </svg>
      )
    default:
      return (
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#8892a4] text-[11px] font-bold text-white">
          {asset[0]}
        </div>
      )
  }
}

function formatPrice(price: number): string {
  return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatVolume(vol: number): string {
  return `$${vol.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatMarketCap(cap: number | null): string {
  if (cap === null) return '--'
  if (cap >= 1_000_000_000) return `$${(cap / 1_000_000_000).toFixed(2)}B`
  if (cap >= 1_000_000) return `$${(cap / 1_000_000).toFixed(2)}M`
  return `$${cap.toLocaleString()}`
}

function Metric({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col">
      <span className="text-[12px] text-[#8892a4]">{label}</span>
      <span className="text-[14px] font-medium text-white">{children}</span>
    </div>
  )
}

export function AssetHeader({ asset, candles, marketCap = null, fundingRate = null, openInterest = null }: AssetHeaderProps) {
  if (candles.length === 0) return null

  const last = candles[candles.length - 1]
  const currentPrice = last.c

  const candlesPerDay = 24
  const dayAgoIdx = Math.max(0, candles.length - candlesPerDay - 1)
  const dayAgoPrice = candles[dayAgoIdx].c
  const change = currentPrice - dayAgoPrice
  const changePct = dayAgoPrice > 0 ? (change / dayAgoPrice) * 100 : 0
  const isPositive = change >= 0

  const dayCandles = candles.slice(-candlesPerDay)
  const high24 = Math.max(...dayCandles.map((c) => c.h))
  const low24 = Math.min(...dayCandles.map((c) => c.l))
  const vol24 = dayCandles.reduce((s, c) => s + c.v * ((c.h + c.l + c.c) / 3), 0)

  const changeColor = isPositive ? 'text-[#00d4ff]' : 'text-[#f87171]'

  return (
    <div className="flex items-center border-b border-border-default bg-surface-body px-6 py-3">
      <div className="flex items-center gap-2.5">
        <AssetIcon asset={asset} />
        <span className="text-[24px] font-semibold text-white">{asset}</span>
      </div>

      <div className="flex flex-1 items-center justify-around">
        <Metric label="Mark">
          ${formatPrice(currentPrice)}
        </Metric>

        <Metric label="24h Change">
          <span className={changeColor}>
            {isPositive ? '+' : ''}{formatPrice(change)} / {isPositive ? '+' : ''}{changePct.toFixed(2)}%
          </span>
        </Metric>

        <Metric label="24h Volume">
          {formatVolume(vol24)}
        </Metric>

        <Metric label="Market Cap">
          {formatMarketCap(marketCap)}
        </Metric>

        <Metric label="Funding">
          {fundingRate !== null ? `${(fundingRate * 100).toFixed(4)}%` : '--'}
        </Metric>

        <Metric label="Open Interest">
          {openInterest !== null ? formatVolume(openInterest) : '--'}
        </Metric>
      </div>
    </div>
  )
}
