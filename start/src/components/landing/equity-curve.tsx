import { useEffect, useRef } from 'react'
import type { LandingPortfolio } from './types'

interface EquityCurveProps {
  data: LandingPortfolio['equityCurve']
}

export function EquityCurve({ data }: EquityCurveProps) {
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
    const padding = { top: 6, right: 4, bottom: 6, left: 4 }

    const equities = data.map((d) => d.equity)
    const minEq = Math.min(...equities)
    const maxEq = Math.max(...equities)
    const range = maxEq - minEq || 1

    ctx.clearRect(0, 0, width, height)

    ctx.beginPath()
    data.forEach((d, i) => {
      const x = padding.left + (i / (data.length - 1)) * (width - padding.left - padding.right)
      const y = padding.top + (1 - (d.equity - minEq) / range) * (height - padding.top - padding.bottom)
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    })
    ctx.strokeStyle = '#34d399'
    ctx.lineWidth = 1.5
    ctx.stroke()

    ctx.lineTo(
      padding.left + (width - padding.left - padding.right),
      height - padding.bottom,
    )
    ctx.lineTo(padding.left, height - padding.bottom)
    ctx.closePath()
    ctx.fillStyle = 'rgba(52, 211, 153, 0.08)'
    ctx.fill()
  }, [data])

  if (data.length < 2) {
    return <div className="flex h-full items-center justify-center text-[11px] text-[#8892a4]">No data yet</div>
  }

  return (
    <canvas
      ref={canvasRef}
      className="h-full w-full"
      style={{ imageRendering: 'crisp-edges' }}
    />
  )
}
