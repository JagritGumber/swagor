import { createAgentChart } from '../components/agent/chart-panel.ts'

const dataEl = document.getElementById('agent-data')
const container = document.getElementById('agent-chart')

if (dataEl && container) {
  const data = JSON.parse(dataEl.textContent!)
  createAgentChart({
    container,
    candles: data.candles,
    segments: data.segments,
    auction: data.auction,
  })
}
