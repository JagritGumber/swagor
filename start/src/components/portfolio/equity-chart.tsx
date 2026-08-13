import { useEffect, useRef } from 'react'
import {
  createChart,
  LineSeries,
  CrosshairMode,
  ColorType,
  type UTCTimestamp,
} from 'lightweight-charts'

interface EquityChartProps {
  data: { timestamp: number; equity: number }[]
}

function formatDate(ts: number): string {
  const d = new Date(ts)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatPrice(val: number): string {
  return `$${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function EquityChart({ data }: EquityChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container || data.length < 2) return

    const chart = createChart(container, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#6b7280',
        fontFamily: '"Inter", system-ui, sans-serif',
        fontSize: 10,
      },
      grid: {
        vertLines: { color: 'rgba(99, 130, 190, 0.06)' },
        horzLines: { color: 'rgba(99, 130, 190, 0.06)' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: 'rgba(99, 179, 237, 0.4)',
          width: 1,
          labelBackgroundColor: '#1a2332',
        },
        horzLine: {
          color: 'rgba(99, 179, 237, 0.4)',
          width: 1,
          labelBackgroundColor: '#1a2332',
        },
      },
      timeScale: {
        borderColor: 'rgba(99, 130, 190, 0.1)',
        timeVisible: false,
        secondsVisible: false,
      },
      rightPriceScale: {
        borderColor: 'rgba(99, 130, 190, 0.1)',
        minimumWidth: 80,
      },
    })

    const series = chart.addSeries(LineSeries, {
      color: '#00d4ff',
      lineWidth: 2,
      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 4,
      crosshairMarkerBackgroundColor: '#00d4ff',
      crosshairMarkerBorderColor: '#ffffff',
      lastValueVisible: true,
      priceLineVisible: false,
      priceFormat: { type: 'custom', formatter: formatPrice },
    })

    const lwData = data.map((d) => ({
      time: (d.timestamp / 1000) as UTCTimestamp,
      value: d.equity,
    }))

    series.setData(lwData)
    chart.timeScale().fitContent()

    const tooltip = document.createElement('div')
    tooltip.style.cssText =
      'position:absolute;display:none;pointer-events:none;z-index:10;padding:6px 10px;border-radius:4px;background:#1a2332;border:1px solid rgba(99,130,190,0.2);font-family:"Inter",system-ui,sans-serif;font-size:11px;color:#e1e4ea;white-space:nowrap;transform:translate(-50%,-100%);margin-top:-8px;'
    container.appendChild(tooltip)

    chart.subscribeCrosshairMove((param) => {
      if (!param.time || !param.point) {
        tooltip.style.display = 'none'
        return
      }
      const dataAt = param.seriesData.get(series)
      if (!dataAt) {
        tooltip.style.display = 'none'
        return
      }
      const ts = (param.time as number) * 1000
      tooltip.innerHTML = `<div style="color:#a3a8b5;margin-bottom:2px">${formatDate(ts)}</div><div style="color:#00d4ff;font-weight:600">${formatPrice(dataAt.value)}</div>`
      tooltip.style.display = 'block'

      const chartRect = container.getBoundingClientRect()
      const x = param.point.x
      const y = param.point.y
      const tooltipW = tooltip.offsetWidth
      const left = Math.max(tooltipW / 2, Math.min(x, chartRect.width - tooltipW / 2))
      tooltip.style.left = `${left}px`
      tooltip.style.top = `${y}px`
    })

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect
        if (width > 0 && height > 0) {
          chart.resize(width, height)
        }
      }
    })
    resizeObserver.observe(container)

    return () => {
      resizeObserver.disconnect()
      tooltip.remove()
      chart.remove()
    }
  }, [data])

  if (data.length < 2) {
    return (
      <div className="flex h-full items-center justify-center text-[13px] text-[#8892a4]">
        No equity data yet
      </div>
    )
  }

  return <div ref={containerRef} className="h-full w-full" />
}
