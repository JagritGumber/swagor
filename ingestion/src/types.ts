
export interface TradeEvent {
  price: number
  size: number
  side: 'buy' | 'sell'
  timestamp: number
}
