import { useEffect, useRef } from 'react'

interface EquityChartProps {
  data: { timestamp: number; equity: number }[]
}

export function EquityChart({ data }: EquityChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || data.length < 2) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    ctx.scale(dpr, dpr)

    const width = rect.width
    const height = rect.height
    const padding = { top: 16, right: 16, bottom: 16, left: 16 }

    const equities = data.map((d) => d.equity)
    const minEq = Math.min(...equities)
    const maxEq = Math.max(...equities)
    const range = maxEq - minEq || 1

    ctx.clearRect(0, 0, width, height)

    // Draw gradient fill
    ctx.beginPath()
    data.forEach((d, i) => {
      const x = padding.left + (i / (data.length - 1)) * (width - padding.left - padding.right)
      const y = padding.top + (1 - (d.equity - minEq) / range) * (height - padding.top - padding.bottom)
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    })
    ctx.strokeStyle = '#00d4ff'
    ctx.lineWidth = 2
    ctx.stroke()

    // Fill area under curve
    ctx.lineTo(
      padding.left + (width - padding.left - padding.right),
      height - padding.bottom,
    )
    ctx.lineTo(padding.left, height - padding.bottom)
    ctx.closePath()
    ctx.fillStyle = 'rgba(0, 212, 255, 0.08)'
    ctx.fill()
  }, [data])

  if (data.length < 2) {
    return (
      <div className="flex h-full items-center justify-center text-[13px] text-[#8892a4]">
        No equity data yet
      </div>
    )
  }

  return (
    <canvas
      ref={canvasRef}
      className="h-full w-full"
      style={{ imageRendering: 'crisp-edges' }}
    />
  )
}