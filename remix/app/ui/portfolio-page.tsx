import type { Handle } from 'remix/ui'
import { css } from 'remix/ui'
import { Document } from './document.tsx'

interface ReaderRegime {
  mode: string
  label: string
  highVol: boolean
  rangePct: number
  driftPct: number
  directionalEfficiency: number
  reason: string
}

interface ReaderAuctionProfile {
  poc: number
  valueAreaLow: number
  valueAreaHigh: number
  binCount: number
}

interface ReaderAuctionLevel {
  price: number
  kind: string
  touches: number
}

interface ReaderAuction {
  location: string
  locationLabel: string
  bias: string
  narrative: string
  invalidation: string | null
  target: string | null
  profile: ReaderAuctionProfile | null
  level: ReaderAuctionLevel | null
}

interface ReaderReadSuccess {
  asset: string
  interval: string
  lastPrice: number
  lastCandleAt: string
  readAt: string
  candleCount: number
  regime: ReaderRegime
  auction: ReaderAuction
  summary: string
}

type ReaderReadResult = ReaderReadSuccess | { error: string }

interface PortfolioPageProps {
  read: ReaderReadResult
}

const FONT_STACK =
  "'JetBrains Mono', ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace"

const tokens = css({
  '--surface-0': '#0d0f11',
  '--surface-1': '#14171a',
  '--surface-2': '#1b1f24',
  '--surface-3': '#24292e',
  '--border': '#30363d',
  '--text-primary': '#e6edf3',
  '--text-secondary': '#8b949e',
  '--text-tertiary': '#6e7681',
  '--green': '#3fb950',
  '--red': '#f85149',
  '--amber': '#d29922',
  '--blue': '#58a6ff',
  '--purple': '#bc8cff',
})

export function PortfolioPage(handle: Handle<PortfolioPageProps>) {
  return () => {
    const { read } = handle.props

    return (
      <Document
        title={`Selbo — ${'error' in read ? 'Read Error' : `${read.asset} ${read.interval}`}`}
        head={
          <>
            <meta name="color-scheme" content="dark" />
            <link rel="preconnect" href="https://fonts.googleapis.com" />
            <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
            <link
              rel="stylesheet"
              href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&display=swap"
            />
          </>
        }
      >
        <div
          mix={[
            tokens,
            css({
              minHeight: '100vh',
              background: 'var(--surface-0)',
              color: 'var(--text-primary)',
              fontFamily: FONT_STACK,
              fontSize: '13px',
              lineHeight: 1.5,
              WebkitFontSmoothing: 'antialiased',
              MozOsxFontSmoothing: 'grayscale',
              '& *, & *::before, & *::after': { boxSizing: 'border-box' },
            }),
          ]}
        >
          {'error' in read ? (
            <ErrorState message={read.error} />
          ) : (
            <Dashboard read={read} />
          )}
        </div>
      </Document>
    )
  }
}

function ErrorState(handle: Handle<{ message: string }>) {
  return () => (
    <div
      mix={css({
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        gap: '12px',
        padding: '24px',
      })}
    >
      <span
        mix={css({
          fontSize: '24px',
          color: 'var(--red)',
          fontWeight: 700,
        })}
      >
        ERROR
      </span>
      <span
        mix={css({
          color: 'var(--text-secondary)',
          textAlign: 'center',
          maxWidth: '480px',
        })}
      >
        {handle.props.message}
      </span>
    </div>
  )
}

function Dashboard(handle: Handle<{ read: ReaderReadSuccess }>) {
  const { read } = handle.props
  const biasColor =
    read.auction.bias === 'long' ? 'var(--green)' :
    read.auction.bias === 'short' ? 'var(--red)' :
    'var(--amber)'

  return () => (
    <div
      mix={css({
        maxWidth: '1100px',
        margin: '0 auto',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
      })}
    >
      <Header read={read} biasColor={biasColor} />
      <div
        mix={css({
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '16px',
          '@media (max-width: 900px)': { gridTemplateColumns: '1fr' },
        })}
      >
        <RegimeCard read={read} />
        <AuctionCard read={read} biasColor={biasColor} />
        <ThesisCard read={read} biasColor={biasColor} />
      </div>
    </div>
  )
}

function Header(handle: Handle<{ read: ReaderReadSuccess; biasColor: string }>) {
  const { read, biasColor } = handle.props
  return () => (
    <div
      mix={css({
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 16px',
        background: 'var(--surface-1)',
        border: `1px solid var(--border)`,
        borderRadius: '8px',
      })}
    >
      <div mix={css({ display: 'flex', alignItems: 'center', gap: '12px' })}>
        <span
          mix={css({
            fontWeight: 700,
            fontSize: '16px',
            color: 'var(--blue)',
          })}
        >
          Selbo
        </span>
        <span
          mix={css({
            color: 'var(--text-secondary)',
            fontSize: '12px',
          })}
        >
          {read.asset} {read.interval}
        </span>
      </div>
      <div mix={css({ display: 'flex', alignItems: 'center', gap: '16px' })}>
        <span mix={css({ color: 'var(--text-secondary)', fontSize: '11px' })}>
          ${read.lastPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
        <span
          mix={css({
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: biasColor,
            display: 'inline-block',
          })}
        />
        <span
          mix={css({
            color: 'var(--text-secondary)',
            fontSize: '11px',
          })}
        >
          {read.candleCount} candles
        </span>
        <span
          mix={css({
            color: 'var(--text-tertiary)',
            fontSize: '10px',
          })}
        >
          {timeAgo(read.readAt)}
        </span>
      </div>
    </div>
  )
}

function RegimeCard(handle: Handle<{ read: ReaderReadSuccess }>) {
  const { read } = handle.props
  const volColor = read.regime.highVol ? 'var(--red)' : 'var(--text-secondary)'
  return () => (
    <Card title="REGIME">
      <Row label="Mode" value={read.regime.label} valueColor={
        read.regime.mode === 'trend-up' ? 'var(--green)' :
        read.regime.mode === 'trend-down' ? 'var(--red)' :
        read.regime.mode === 'high-vol' ? 'var(--red)' : 'var(--text-primary)'
      } />
      <Row label="Range" value={`${read.regime.rangePct}%`} />
      <Row label="Drift" value={`${read.regime.driftPct}%`} valueColor={
        read.regime.driftPct > 0.5 ? 'var(--green)' :
        read.regime.driftPct < -0.5 ? 'var(--red)' : 'var(--text-secondary)'
      } />
      <Row label="Dir. Eff." value={String(read.regime.directionalEfficiency)} />
      <Row label="High Vol" value={read.regime.highVol ? 'YES' : 'no'} valueColor={volColor} />
      <div
        mix={css({
          marginTop: '8px',
          paddingTop: '8px',
          borderTop: `1px solid var(--border)`,
          fontSize: '11px',
          color: 'var(--text-tertiary)',
          lineHeight: 1.6,
        })}
      >
        {read.regime.reason}
      </div>
    </Card>
  )
}

function AuctionCard(handle: Handle<{ read: ReaderReadSuccess; biasColor: string }>) {
  const { read, biasColor } = handle.props
  return () => (
    <Card title="AUCTION">
      <Row label="Location" value={read.auction.locationLabel} />
      <Row label="Bias" value={read.auction.bias.toUpperCase()} valueColor={biasColor} />
      {read.auction.profile && (
        <>
          <Row label="POC" value={`$${read.auction.profile.poc.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} />
          <Row label="VA Low" value={`$${read.auction.profile.valueAreaLow.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} />
          <Row label="VA High" value={`$${read.auction.profile.valueAreaHigh.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} />
          <Row label="Bins" value={String(read.auction.profile.binCount)} />
        </>
      )}
      {read.auction.level && (
        <Row label="Level" value={`${read.auction.level.kind} @ $${read.auction.level.price.toFixed(2)}`} />
      )}
      <div
        mix={css({
          marginTop: '8px',
          paddingTop: '8px',
          borderTop: `1px solid var(--border)`,
          fontSize: '11px',
          color: 'var(--text-tertiary)',
          lineHeight: 1.6,
        })}
      >
        {read.auction.narrative}
      </div>
    </Card>
  )
}

function ThesisCard(handle: Handle<{ read: ReaderReadSuccess; biasColor: string }>) {
  const { read, biasColor } = handle.props
  return () => (
    <Card title="THESIS">
      <div
        mix={css({
          fontSize: '12px',
          lineHeight: 1.7,
          color: 'var(--text-primary)',
          marginBottom: '12px',
        })}
      >
        {read.summary}
      </div>
      {read.auction.invalidation && (
        <div
          mix={css({
            padding: '8px 10px',
            background: 'var(--surface-2)',
            borderRadius: '6px',
            border: `1px solid var(--border)`,
            fontSize: '11px',
            lineHeight: 1.6,
            marginBottom: '8px',
          })}
        >
          <div
            mix={css({
              fontSize: '10px',
              fontWeight: 700,
              color: 'var(--red)',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              marginBottom: '4px',
            })}
          >
            Invalidation
          </div>
          <span mix={css({ color: 'var(--text-secondary)' })}>{read.auction.invalidation}</span>
        </div>
      )}
      {read.auction.target && (
        <div
          mix={css({
            padding: '8px 10px',
            background: 'var(--surface-2)',
            borderRadius: '6px',
            border: `1px solid var(--border)`,
            fontSize: '11px',
            lineHeight: 1.6,
          })}
        >
          <div
            mix={css({
              fontSize: '10px',
              fontWeight: 700,
              color: biasColor,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              marginBottom: '4px',
            })}
          >
            Target
          </div>
          <span mix={css({ color: 'var(--text-secondary)' })}>{read.auction.target}</span>
        </div>
      )}
    </Card>
  )
}

function Card(handle: Handle<{ title: string; children?: import('remix/ui').RemixNode }>) {
  const { title, children } = handle.props
  return () => (
    <div
      mix={css({
        background: 'var(--surface-1)',
        border: `1px solid var(--border)`,
        borderRadius: '8px',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
      })}
    >
      <div
        mix={css({
          fontSize: '11px',
          fontWeight: 700,
          color: 'var(--text-tertiary)',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          marginBottom: '14px',
        })}
      >
        {title}
      </div>
      {children}
    </div>
  )
}

function Row(handle: Handle<{ label: string; value: string; valueColor?: string }>) {
  const { label, value, valueColor } = handle.props
  return () => (
    <div
      mix={css({
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '3px 0',
        fontSize: '12px',
      })}
    >
      <span mix={css({ color: 'var(--text-secondary)' })}>{label}</span>
      <span
        mix={css({ color: valueColor ?? 'var(--text-primary)', fontWeight: 500 })}
      >
        {value}
      </span>
    </div>
  )
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const secs = Math.floor(diff / 1000)
  if (secs < 60) return `${secs}s ago`
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins}m ago`
  return `${Math.floor(mins / 60)}h ago`
}
