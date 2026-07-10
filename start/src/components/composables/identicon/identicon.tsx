import type { IdenticonProps } from './types'

function hashBytes(address: string): number[] {
  const lower = address.toLowerCase().replace('0x', '')
  if (lower.length % 2 !== 0) {
    throw new Error(`Identicon: address hex length must be even, got ${lower.length} for "${address}"`)
  }
  const bytes = new Array<number>(lower.length / 2)
  for (let i = 0; i < bytes.length; i++) {
    const n = parseInt(lower.slice(i * 2, i * 2 + 2), 16)
    if (Number.isNaN(n)) {
      throw new Error(`Identicon: invalid hex in address "${address}" at byte ${i}`)
    }
    bytes[i] = n
  }
  if (bytes.length === 0) {
    throw new Error(`Identicon: address produced empty byte array: "${address}"`)
  }
  return bytes
}

function color(bytes: number[], index: number): string {
  const b = bytes[index % bytes.length]
  if (b === undefined) {
    throw new Error(`Identicon: missing byte at index ${index}`)
  }
  const b0 = bytes[0]
  const b1 = bytes[1] ?? bytes[0]
  if (b0 === undefined || b1 === undefined) {
    throw new Error('Identicon: insufficient bytes for color')
  }
  const h = (b0 * 3 + b1 * 5) % 360
  const s = 50 + (b % 40)
  const l = 45 + (b % 20)
  return `hsl(${h}, ${s}%, ${l}%)`
}

function buildCells(address: string): { x: number; y: number; color: string }[] {
  const bytes = hashBytes(address)
  const cells: { x: number; y: number; color: string }[] = []
  const GRID = 5
  const LEFT_COLS = 3

  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < LEFT_COLS; x++) {
      const idx = (y * GRID + x + bytes[0]!) % bytes.length
      const active = bytes[idx]! % 2 === 0
      if (!active) continue
      const c = color(bytes, idx)
      cells.push({ x, y, color: c })
      const mirror = GRID - 1 - x
      if (mirror !== x) cells.push({ x: mirror, y, color: c })
    }
  }
  return cells
}

export function Identicon({ address, size = 24 }: IdenticonProps) {
  if (!address) {
    throw new Error('Identicon: address is required')
  }
  const cells = buildCells(address)

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 5 5"
      xmlns="http://www.w3.org/2000/svg"
      shapeRendering="crispEdges"
      aria-hidden="true"
    >
      <rect x={0} y={0} width={5} height={5} fill="transparent" rx={0.5} />
      {cells.map((cell) => (
        <rect
          key={`${cell.x}-${cell.y}`}
          x={cell.x}
          y={cell.y}
          width={1}
          height={1}
          fill={cell.color}
          rx={0.15}
        />
      ))}
    </svg>
  )
}
