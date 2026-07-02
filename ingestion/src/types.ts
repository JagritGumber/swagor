export interface Candle {
  t: number
  o: number
  h: number
  l: number
  c: number
  v: number
}

export interface StoredCandle extends Candle {
  asset: string
  interval: string
  closed: boolean
}

export interface TradeEvent {
  price: number
  size: number
  side: 'buy' | 'sell'
  timestamp: number
}
