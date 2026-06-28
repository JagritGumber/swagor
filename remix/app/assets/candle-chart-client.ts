import { createChart } from '../components/chart/create-chart.ts'

const container = document.getElementById('chart-container')
if (container !== null && container.querySelector('canvas') === null) {
  const chart = createChart({ container })
  chart.render()
}
