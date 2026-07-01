import { createAgentChart } from '../components/agent/chart-panel.ts'

const dataEl = document.getElementById('agent-data')
if (!dataEl) throw new Error('Missing #agent-data script tag')

const raw = dataEl.textContent
if (!raw) throw new Error('#agent-data script tag is empty')

const data = JSON.parse(raw)

const container = document.getElementById('agent-chart')
if (!container) throw new Error('Missing #agent-chart container')

createAgentChart({
  container,
  candles: data.candles,
  segments: data.segments,
  auction: data.auction,
  plan: data.plan,
})
