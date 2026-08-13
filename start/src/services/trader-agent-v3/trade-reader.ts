export type Trade = {
  side: 'buy' | 'sell'
  price: number
  size: number
  time: number
}

export type LiquidationLevel = {
  price: number
  estimatedSize: number
  side: 'long' | 'short'
}

export type TradePattern = {
  timestamp: number
  // Trade aggression
  buyVolume: number
  sellVolume: number
  delta: number
  buyRatio: number
  tradeCount: number
  // Size distribution
  avgTradeSize: number
  largeTradeRatio: number
  largestTradeSize: number
  // Absorption (trades without price movement)
  absorptionStrength: number
  // Initiative (trades walking price)
  initiativeStrength: number
  // Liquidation proximity
  nearestLiqDistance: number
  liqApproachSpeed: number
  // Price movement
  priceChange: number
  volatility: number
}

export type TradeReaderConfig = {
  windowMs: number
  largeTradePercentile: number
  absorptionThreshold: number
}

const DEFAULT_CONFIG: TradeReaderConfig = {
  windowMs: 60_000,
  largeTradePercentile: 0.9,
  absorptionThreshold: 0.001,
}

export function readTradePattern(
  trades: Trade[],
  liquidationLevels: LiquidationLevel[],
  config: TradeReaderConfig = DEFAULT_CONFIG,
): TradePattern | null {
  if (trades.length === 0) return null

  const first = trades[0]
  const last = trades[trades.length - 1]

  // Trade aggression
  const buyVolume = trades.filter(t => t.side === 'buy').reduce((sum, t) => sum + t.size, 0)
  const sellVolume = trades.filter(t => t.side === 'sell').reduce((sum, t) => sum + t.size, 0)
  const totalVolume = buyVolume + sellVolume
  const delta = buyVolume - sellVolume
  const buyRatio = totalVolume > 0 ? buyVolume / totalVolume : 0.5
  const tradeCount = trades.length

  // Size distribution
  const sizes = trades.map(t => t.size).sort((a, b) => a - b)
  const avgTradeSize = totalVolume / tradeCount
  const largeThreshold = sizes[Math.floor(sizes.length * config.largeTradePercentile)] ?? 0
  const largeTradeVolume = trades.filter(t => t.size >= largeThreshold).reduce((sum, t) => sum + t.size, 0)
  const largeTradeRatio = totalVolume > 0 ? largeTradeVolume / totalVolume : 0
  const largestTradeSize = sizes[sizes.length - 1] ?? 0

  // Absorption: large trades without price movement
  const priceRange = Math.abs(last.price - first.price) / first.price
  const hasLargeTrades = largeTradeRatio > 0.3
  const priceDidNotMove = priceRange < config.absorptionThreshold
  const absorptionStrength = hasLargeTrades && priceDidNotMove ? Math.min(1, largeTradeRatio * 2) : 0

  // Initiative: trades walking price
  const buyTrades = trades.filter(t => t.side === 'buy')
  const sellTrades = trades.filter(t => t.side === 'sell')
  const buyPriceImpact = buyTrades.length > 1
    ? (buyTrades[buyTrades.length - 1].price - buyTrades[0].price) / buyTrades[0].price
    : 0
  const sellPriceImpact = sellTrades.length > 1
    ? (sellTrades[0].price - sellTrades[sellTrades.length - 1].price) / sellTrades[0].price
    : 0
  const initiativeStrength = Math.max(buyPriceImpact, sellPriceImpact) * 10000 // in bps

  // Liquidation proximity
  const lastPrice = last.price
  let nearestLiqDistance = Infinity
  let liqApproachSpeed = 0
  for (const level of liquidationLevels) {
    const distance = Math.abs(level.price - lastPrice) / lastPrice
    if (distance < nearestLiqDistance) {
      nearestLiqDistance = distance
      // Approach speed: how fast price is moving toward the level
      const priceDirection = lastPrice - first.price
      const towardLevel = level.price - lastPrice
      liqApproachSpeed = priceDirection * towardLevel > 0 ? Math.abs(priceDirection) / first.price * 10000 : 0
    }
  }
  if (nearestLiqDistance === Infinity) nearestLiqDistance = 1 // No liquidation levels = far away

  // Price movement
  const priceChange = (last.price - first.price) / first.price * 10000 // bps
  const returns = trades.slice(1).map((t, i) => Math.log(t.price / trades[i].price))
  const meanReturn = returns.length > 0 ? returns.reduce((sum, r) => sum + r, 0) / returns.length : 0
  const variance = returns.length > 0 ? returns.reduce((sum, r) => sum + (r - meanReturn) ** 2, 0) / returns.length : 0
  const volatility = Math.sqrt(variance) * 10000 // bps

  return {
    timestamp: last.time,
    buyVolume,
    sellVolume,
    delta,
    buyRatio,
    tradeCount,
    avgTradeSize,
    largeTradeRatio,
    largestTradeSize,
    absorptionStrength,
    initiativeStrength,
    nearestLiqDistance,
    liqApproachSpeed,
    priceChange,
    volatility,
  }
}

export function patternToVector(pattern: TradePattern): number[] {
  return [
    pattern.buyRatio,
    pattern.delta / 1000,
    pattern.tradeCount / 100,
    pattern.avgTradeSize / 100,
    pattern.largeTradeRatio,
    pattern.largestTradeSize / 1000,
    pattern.absorptionStrength,
    pattern.initiativeStrength,
    pattern.nearestLiqDistance,
    pattern.liqApproachSpeed,
    pattern.priceChange,
    pattern.volatility,
  ]
}
