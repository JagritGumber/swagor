import type { Handle } from 'remix/ui'
import { Document } from '../document.tsx'
import { Hero } from '../components/landing/hero.tsx'

export function LandingPage(handle: Handle<Record<string, never>>) {
  return () => (
    <Document
      title="Selbo — AI Trading Agent"
      head={
        <>
          <meta name="color-scheme" content="dark" />
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
          <link
            rel="stylesheet"
            href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          />
          <link
            rel="stylesheet"
            href="https://unpkg.com/@phosphor-icons/web@2.0.3/src/regular/style.css"
          />
        </>
      }
    >
      <Hero />
    </Document>
  )
}
