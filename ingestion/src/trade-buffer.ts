import type { TradeEvent } from './types.ts'

export interface TradeBuffer {
  push(event: TradeEvent): void
  getAll(): TradeEvent[]
  flush(): TradeEvent[]
}

export function createTradeBuffer(maxSize = 1000): TradeBuffer {
  const buf: TradeEvent[] = []
  let start = 0
  let count = 0

  function push(event: TradeEvent): void {
    if (count < maxSize) {
      buf.push(event)
      count++
    } else {
      buf[start] = event
      start = (start + 1) % maxSize
    }
  }

  function getAll(): TradeEvent[] {
    if (count === 0) return []
    const out: TradeEvent[] = []
    for (let i = 0; i < count; i++) {
      out.push(buf[(start + i) % buf.length])
    }
    return out
  }

  function flush(): TradeEvent[] {
    const out = getAll()
    buf.length = 0
    start = 0
    count = 0
    return out
  }

  return { push, getAll, flush }
}
