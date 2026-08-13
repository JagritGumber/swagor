export type MeasurementConfig = {
  windowMs: number
  symbol: string
}

export type Measurement = {
  timestamp: number
  symbol: string
  windowMs: number
  // Price
  open: number
  high: number
  low: number
  close: number
  // Volume
  buyVolume: number
  sellVolume: number
  delta: number
  buyRatio: number
  totalVolume: number
  // Trades
  tradeCount: number
  avgTradeSize: number
  largestTradeSize: number
  largestTradeSide: 1 | -1
  medianTradeSize: number
  // Imbalance
  largeTradeRatio: number
  absorptionStrength: number
  // Price-volume
  volumeAtHigh: number
  volumeAtLow: number
  // Price context
  distanceToVWAP: number
  distanceToSessionHigh: number
  distanceToSessionLow: number
  // Market
  atr: number
  realizedVolatility: number
}

export type OrderflowBucket = {
  bucketMs: number
  open: number
  high: number
  low: number
  close: number
  buyVolume: number
  sellVolume: number
  delta: number
  tradeCount: number
  largestTradeSize: number
  largestTradePrice: number
  largestTradeSide: 'buy' | 'sell'
  lastTradePrice: number
}

export function aggregateBucketsToMeasurement(
  buckets: OrderflowBucket[],
  windowMs: number,
  symbol: string,
): Measurement {
  if (buckets.length === 0) {
    throw new Error('Cannot create measurement from empty buckets')
  }

  const first = buckets[0]
  const last = buckets[buckets.length - 1]

  const buyVolume = buckets.reduce((sum, b) => sum + b.buyVolume, 0)
  const sellVolume = buckets.reduce((sum, b) => sum + b.sellVolume, 0)
  const totalVolume = buyVolume + sellVolume
  const delta = buyVolume - sellVolume
  const buyRatio = totalVolume > 0 ? buyVolume / totalVolume : 0.5

  const tradeCount = buckets.reduce((sum, b) => sum + b.tradeCount, 0)
  const allSizes = buckets.flatMap(b => [b.largestTradeSize])
  const avgTradeSize = tradeCount > 0 ? totalVolume / tradeCount : 0
  const largestTrade = buckets.reduce(
    (max, b) => (b.largestTradeSize > max.size ? { size: b.largestTradeSize, side: b.largestTradeSide } : max),
    { size: 0, side: 'buy' as 'buy' | 'sell' },
  )
  const medianTradeSize = avgTradeSize // Simplified - could compute actual median

  // Large trade ratio: top 10% of volume
  const sortedBuckets = [...buckets].sort((a, b) => (b.buyVolume + b.sellVolume) - (a.buyVolume + a.sellVolume))
  const top10PctCount = Math.max(1, Math.ceil(buckets.length * 0.1))
  const largeTradeVolume = sortedBuckets
    .slice(0, top10PctCount)
    .reduce((sum, b) => sum + b.buyVolume + b.sellVolume, 0)
  const largeTradeRatio = totalVolume > 0 ? largeTradeVolume / totalVolume : 0

  // Absorption: volume without price movement
  const priceRange = last.close - first.open
  const priceMoved = Math.abs(priceRange) / first.open > 0.001
  const absorptionStrength = priceMoved ? 0 : Math.min(1, totalVolume / 1000)

  // Volume at high/low
  const avgPrice = buckets.reduce((sum, b) => sum + (b.high + b.low + b.close) / 3, 0) / buckets.length
  const highThreshold = avgPrice + (last.high - avgPrice) * 0.3
  const lowThreshold = avgPrice - (avgPrice - last.low) * 0.3
  const volumeAtHigh = buckets
    .filter(b => b.high >= highThreshold)
    .reduce((sum, b) => sum + b.buyVolume + b.sellVolume, 0)
  const volumeAtLow = buckets
    .filter(b => b.low <= lowThreshold)
    .reduce((sum, b) => sum + b.buyVolume + b.sellVolume, 0)

  // VWAP
  const vwap = buckets.reduce((sum, b) => sum + ((b.high + b.low + b.close) / 3) * (b.buyVolume + b.sellVolume), 0) / totalVolume
  const lastPrice = last.close
  const distanceToVWAP = vwap !== 0 ? (lastPrice - vwap) / vwap : 0

  // Session high/low
  const sessionHigh = Math.max(...buckets.map(b => b.high))
  const sessionLow = Math.min(...buckets.map(b => b.low))
  const distanceToSessionHigh = sessionHigh !== 0 ? (lastPrice - sessionHigh) / sessionHigh : 0
  const distanceToSessionLow = sessionLow !== 0 ? (lastPrice - sessionLow) / sessionLow : 0

  // ATR (simplified - using bucket range)
  const atr = buckets.reduce((sum, b) => sum + (b.high - b.low), 0) / buckets.length

  // Realized volatility (simplified - using returns)
  const returns = buckets.slice(1).map((b, i) => Math.log(b.close / buckets[i].close))
  const meanReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length
  const variance = returns.reduce((sum, r) => sum + (r - meanReturn) ** 2, 0) / returns.length
  const realizedVolatility = Math.sqrt(variance)

  return {
    timestamp: last.bucketMs,
    symbol,
    windowMs,
    open: first.open,
    high: sessionHigh,
    low: sessionLow,
    close: last.close,
    buyVolume,
    sellVolume,
    delta,
    buyRatio,
    totalVolume,
    tradeCount,
    avgTradeSize,
    largestTradeSize: largestTrade.size,
    largestTradeSide: largestTrade.side === 'buy' ? 1 : -1,
    medianTradeSize,
    largeTradeRatio,
    absorptionStrength,
    volumeAtHigh,
    volumeAtLow,
    distanceToVWAP,
    distanceToSessionHigh,
    distanceToSessionLow,
    atr,
    realizedVolatility,
  }
}

export function measurementsFromBuckets(
  buckets: OrderflowBucket[],
  config: MeasurementConfig,
): Measurement[] {
  const measurements: Measurement[] = []
  if (buckets.length === 0) return measurements

  const windowStart = buckets[0].bucketMs
  const windowEnd = buckets[buckets.length - 1].bucketMs

  // Use binary search for faster windowing
  for (let t = windowStart; t <= windowEnd; t += config.windowMs) {
    const windowEndMs = t + config.windowMs
    const windowBuckets: OrderflowBucket[] = []

    // Binary search for start index
    let lo = 0, hi = buckets.length - 1
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (buckets[mid].bucketMs < t) lo = mid + 1
      else hi = mid
    }

    // Collect buckets in window
    for (let i = lo; i < buckets.length && buckets[i].bucketMs < windowEndMs; i++) {
      windowBuckets.push(buckets[i])
    }

    if (windowBuckets.length === 0) continue
    measurements.push(aggregateBucketsToMeasurement(windowBuckets, config.windowMs, config.symbol))
  }

  return measurements
}
