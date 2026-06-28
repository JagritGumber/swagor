import type { Handle } from 'remix/ui'
import { css } from 'remix/ui'
import { useRef, useEffect } from 'react'

import type { Candle } from '../../types/candles.ts'
import type { OverlayData } from './types.ts'
import { renderChart } from './chart-canvas.ts'

interface CandleChartProps {
  candles: Candle[]
  overlays: OverlayData
}

export function CandleChart(handle: Handle<CandleChartProps>) {
  return () => {
    const ref = useRef<HTMLCanvasElement>(null)
    const { candles, overlays } = handle.props

    useEffect(() => {
      const canvas = ref.current
      if (!canvas || candles.length === 0) return

      function render() {
        const cvs = ref.current
        if (!cvs) return
        const dpr = window.devicePixelRatio || 1
        const rect = cvs.getBoundingClientRect()
        cvs.width = rect.width * dpr
        cvs.height = rect.height * dpr

        const ctx = cvs.getContext('2d')
        if (!ctx) return

        ctx.scale(dpr, dpr)

        const config = {
          width: rect.width,
          height: rect.height,
          padding: { top: 16, right: 60, bottom: 8, left: 8 },
        }

        renderChart(ctx, candles, overlays, config)
      }

      render()

      const observer = new ResizeObserver(() => render())
      observer.observe(canvas)
      return () => observer.disconnect()
    }, [candles, overlays])

    return (
      <canvas
        ref={ref}
        style={{ display: 'block', width: '100%', height: 'calc(100vh - 48px)' }}
      />
    )
  }
}
