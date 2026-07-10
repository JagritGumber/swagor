import type { Handle } from 'remix/ui'
import type { IdenticonProps } from './types.ts'

function hashBytes(address: string): number[] {
  const lower = address.toLowerCase().replace('0x', '')
  const bytes = new Array(lower.length / 2)
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(lower.slice(i * 2, i * 2 + 2), 16)
  }
  return bytes
}

function color(bytes: number[], index: number): string {
  const b = bytes[index % bytes.length]
  const h = (bytes[0] * 3 + bytes[1] * 5) % 360
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
      const idx = (y * GRID + x + bytes[0]) % bytes.length
      const active = bytes[idx] % 2 === 0
      if (!active) continue
      const c = color(bytes, idx)
      cells.push({ x, y, color: c })
      const mirror = GRID - 1 - x
      if (mirror !== x) cells.push({ x: mirror, y, color: c })
    }
  }
  return cells
}

export function Identicon(handle: Handle<IdenticonProps>) {
  return () => {
    const { address, size = 24 } = handle.props
    const cells = buildCells(address)

    return (
    <svg
      width={String(size)}
      height={String(size)}
      viewBox={`0 0 5 5`}
      xmlns="http://www.w3.org/2000/svg"
      shape-rendering="crispEdges"
      aria-hidden="true"
    >
      <rect x={0} y={0} width={5} height={5} fill="transparent" rx={0.5} />
      {cells.map(cell => (
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
}
