export interface JudgmentUpdate {
  asset: string
  regime: { mode: string; label: string; rangePct: number; driftPct: number } | null
  auction: { location: string; locationLabel: string; bias: string; narrative: string } | null
  stance: string
  confidence: number
  narrative: string
  updatedAt: number
}

interface LiveJudgmentCallbacks {
  onJudgment: (data: JudgmentUpdate) => void
  onError: (error: Event) => void
}

export function connectLiveJudgment(
  asset: string,
  callbacks: LiveJudgmentCallbacks,
  signal: AbortSignal,
): void {
  const baseUrl = typeof window !== 'undefined'
    ? `http://${window.location.hostname}:44100`
    : 'http://localhost:44100'

  const source = new EventSource(
    `${baseUrl}/api/judgment/stream?asset=${asset}`
  )

  source.addEventListener('init', (e) => {
    callbacks.onJudgment(JSON.parse(e.data))
  })

  source.addEventListener('judgment-update', (e) => {
    callbacks.onJudgment(JSON.parse(e.data))
  })

  source.addEventListener('error', callbacks.onError)

  signal.addEventListener('abort', () => source.close())
}