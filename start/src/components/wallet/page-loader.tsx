import { useEffect, useState } from 'react'

export function PageLoader() {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    setReady(true)
  }, [])

  return (
    <div
      className={[
        'absolute inset-0 z-50 flex items-center justify-center bg-surface-body transition-opacity duration-100',
        ready ? 'pointer-events-none opacity-0' : 'pointer-events-auto opacity-100',
      ].join(' ')}
      aria-hidden={ready}
    >
      <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#1e293b] border-t-accent-green" />
    </div>
  )
}
