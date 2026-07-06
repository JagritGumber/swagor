import { clientEntry, css, type Handle } from 'remix/ui'

export const PageLoader = clientEntry(
  import.meta.url,
  function PageLoader(handle: Handle<Record<string, never>>) {
    let ready = false
    let hydrated = false

    return () => {
      if (typeof window !== 'undefined' && !hydrated) {
        hydrated = true
        queueMicrotask(() => {
          ready = true
          handle.update()
        })
      }

      return (
        <div
          mix={css({
            position: 'absolute',
            inset: 0,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            background: '#0a0e14',
            transition: 'opacity 0.1s ease',
            opacity: ready ? 0 : 1,
            pointerEvents: ready ? 'none' : 'auto',
          })}
        >
          <div
            mix={css({
              width: '20px',
              height: '20px',
              border: '2px solid #1e293b',
              borderTopColor: '#00d4ff',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            })}
          />
        </div>
      )
    }
  },
)
