import { createAgentChart } from '../components/agent/chart-panel.ts'

const dataEl = document.getElementById('agent-data')
const container = document.getElementById('agent-chart')

const raw = dataEl?.textContent
if (raw && container) {
  const data = JSON.parse(raw)
  createAgentChart({
    container,
    candles: data.candles,
    segments: data.segments,
    auction: data.auction,
    plan: data.plan,
  })
}
