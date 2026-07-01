import type { P, Coordinate } from '../../types/shared.ts'

type RectState = P<Coordinate & { w: number; h: number; color: string }>
export function rect(ctx: CanvasRenderingContext2D) {
  const state: RectState = { x: 0, y: 0, w: 0, h: 0, color: '' }
  const api = {
    x: (v: number) => { state.x = v; return api },
    y: (v: number) => { state.y = v; return api },
    w: (v: number) => { state.w = v; return api },
    h: (v: number) => { state.h = v; return api },
    color: (v: string) => { state.color = v; return api },
    fill: () => { ctx.fillStyle = state.color; ctx.fillRect(state.x, state.y, state.w, state.h) },
  }
  return api
}

type LineState = P<{ from: Coordinate; to: Coordinate; color: string; width: number; dash: number[] | undefined }>
export function line(ctx: CanvasRenderingContext2D) {
  const state: LineState = { from: { x: 0, y: 0 }, to: { x: 0, y: 0 }, color: '', width: 1, dash: undefined }
  const api = {
    from: (x: number, y: number) => { state.from = { x, y }; return api },
    to: (x: number, y: number) => { state.to = { x, y }; return api },
    color: (v: string) => { state.color = v; return api },
    width: (v: number) => { state.width = v; return api },
    dash: (v: number[]) => { state.dash = v; return api },
    stroke: () => {
      ctx.strokeStyle = state.color
      ctx.lineWidth = state.width
      if (state.dash) ctx.setLineDash(state.dash)
      ctx.beginPath()
      ctx.moveTo(state.from.x, state.from.y)
      ctx.lineTo(state.to.x, state.to.y)
      ctx.stroke()
      if (state.dash) ctx.setLineDash([])
    },
  }
  return api
}

type TextState = P<Coordinate & { text: string; color: string; font: string; align: CanvasTextAlign; baseline: CanvasTextBaseline }>
export function text(ctx: CanvasRenderingContext2D) {
  const state: TextState = { x: 0, y: 0, text: '', color: '', font: '', align: 'right', baseline: 'middle' }
  const api = {
    at: (x: number, y: number) => { state.x = x; state.y = y; return api },
    content: (v: string) => { state.text = v; return api },
    color: (v: string) => { state.color = v; return api },
    font: (v: string) => { state.font = v; return api },
    align: (v: CanvasTextAlign) => { state.align = v; return api },
    baseline: (v: CanvasTextBaseline) => { state.baseline = v; return api },
    draw: () => {
      ctx.fillStyle = state.color
      ctx.font = state.font
      ctx.textAlign = state.align
      ctx.textBaseline = state.baseline
      ctx.fillText(state.text, state.x, state.y)
    },
  }
  return api
}

type CircleState = P<Coordinate & { r: number; color: string }>
export function circle(ctx: CanvasRenderingContext2D) {
  const state: CircleState = { x: 0, y: 0, r: 0, color: '' }
  const api = {
    x: (v: number) => { state.x = v; return api },
    y: (v: number) => { state.y = v; return api },
    r: (v: number) => { state.r = v; return api },
    color: (v: string) => { state.color = v; return api },
    fill: () => {
      ctx.fillStyle = state.color
      ctx.beginPath()
      ctx.arc(state.x, state.y, state.r, 0, Math.PI * 2)
      ctx.fill()
    },
    stroke: () => {
      ctx.strokeStyle = state.color
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.arc(state.x, state.y, state.r, 0, Math.PI * 2)
      ctx.stroke()
    },
  }
  return api
}

type LabelState = P<Coordinate & { text: string; color: string; font: string; align: CanvasTextAlign; bgColor: string; borderColor: string }>
export function label(ctx: CanvasRenderingContext2D) {
  const state: LabelState = { x: 0, y: 0, text: '', color: '', font: '', align: 'right', bgColor: 'rgba(10, 14, 20, 0.85)', borderColor: 'rgba(255, 255, 255, 0.1)' }
  const api = {
    at: (x: number, y: number) => { state.x = x; state.y = y; return api },
    text: (v: string) => { state.text = v; return api },
    color: (v: string) => { state.color = v; return api },
    font: (v: string) => { state.font = v; return api },
    align: (v: CanvasTextAlign) => { state.align = v; return api },
    bg: (color: string) => { state.bgColor = color; return api },
    border: (color: string) => { state.borderColor = color; return api },
    draw: () => {
      ctx.font = state.font
      ctx.textAlign = state.align
      ctx.textBaseline = 'middle'
      const textWidth = ctx.measureText(state.text).width
      const pad = 4
      const bgH = 16
      const bgW = textWidth + pad * 2
      let bgX = state.x
      if (state.align === 'right') bgX = state.x - bgW
      else if (state.align === 'center') bgX = state.x - bgW / 2

      ctx.fillStyle = state.bgColor
      ctx.fillRect(bgX, state.y - bgH / 2, bgW, bgH)
      ctx.fillStyle = state.borderColor
      ctx.fillRect(bgX, state.y - bgH / 2, 1, bgH)
      ctx.fillStyle = state.color
      ctx.fillText(state.text, state.x, state.y)
    },
  }
  return api
}
