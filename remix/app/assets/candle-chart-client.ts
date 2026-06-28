import { createChart } from '../components/chart/create-chart.ts'

const chart = createChart({ container: '#chart-container' })
chart.render().catch((err) => console.error('Chart mount failed:', err))
