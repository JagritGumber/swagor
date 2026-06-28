export function rect(ctx: CanvasRenderingContext2D) {
  const s: { x: number; y: number; w: number; h: number; color: string } = { x: 0, y: 0, w: 0, h: 0, color: '' }
  const api = {
    x: (v: number) => { s.x = v; return api },
    y: (v: number) => { s.y = v; return api },
    w: (v: number) => { s.w = v; return api },
    h: (v: number) => { s.h = v; return api },
    color: (v: string) => { s.color = v; return api },
    fill: () => { ctx.fillStyle = s.color; ctx.fillRect(s.x, s.y, s.w, s.h) },
  }
  return api
}

export function line(ctx: CanvasRenderingContext2D) {
  const s: { x1: number; y1: number; x2: number; y2: number; color: string; width: number; dash: [number, number] | undefined } = { x1: 0, y1: 0, x2: 0, y2: 0, color: '', width: 1, dash: undefined }
  const api = {
    from: (x: number, y: number) => { s.x1 = x; s.y1 = y; return api },
    to: (x: number, y: number) => { s.x2 = x; s.y2 = y; return api },
    color: (v: string) => { s.color = v; return api },
    width: (v: number) => { s.width = v; return api },
    dash: (v: [number, number]) => { s.dash = v; return api },
    stroke: () => {
      ctx.strokeStyle = s.color
      ctx.lineWidth = s.width
      if (s.dash) ctx.setLineDash(s.dash)
      ctx.beginPath()
      ctx.moveTo(s.x1, s.y1)
      ctx.lineTo(s.x2, s.y2)
      ctx.stroke()
      if (s.dash) ctx.setLineDash([])
    },
  }
  return api
}

export function text(ctx: CanvasRenderingContext2D) {
  const s: { x: number; y: number; text: string; color: string; font: string; align: CanvasTextAlign; baseline: CanvasTextBaseline } = { x: 0, y: 0, text: '', color: '', font: '', align: 'right', baseline: 'middle' }
  const api = {
    at: (x: number, y: number) => { s.x = x; s.y = y; return api },
    content: (v: string) => { s.text = v; return api },
    color: (v: string) => { s.color = v; return api },
    font: (v: string) => { s.font = v; return api },
    align: (v: CanvasTextAlign) => { s.align = v; return api },
    baseline: (v: CanvasTextBaseline) => { s.baseline = v; return api },
    draw: () => {
      ctx.fillStyle = s.color
      ctx.font = s.font
      ctx.textAlign = s.align
      ctx.textBaseline = s.baseline
      ctx.fillText(s.text, s.x, s.y)
    },
  }
  return api
}

export function circle(ctx: CanvasRenderingContext2D) {
  const s: { x: number; y: number; r: number; color: string } = { x: 0, y: 0, r: 0, color: '' }
  const api = {
    x: (v: number) => { s.x = v; return api },
    y: (v: number) => { s.y = v; return api },
    r: (v: number) => { s.r = v; return api },
    color: (v: string) => { s.color = v; return api },
    fill: () => {
      ctx.fillStyle = s.color
      ctx.beginPath()
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
      ctx.fill()
    },
    stroke: () => {
      ctx.strokeStyle = s.color
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
      ctx.stroke()
    },
  }
  return api
}
