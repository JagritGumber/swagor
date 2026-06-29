import type { Handle } from 'remix/ui'
import { css } from 'remix/ui'

const FLOATING_ICONS = [
  { label: 'Market Scan', icon: 'search', x: -180, y: -60, delay: 0 },
  { label: 'Execute Trade', icon: 'zap', x: -180, y: 80, delay: 0.1 },
  { label: 'Decision', icon: 'brain', x: 180, y: -60, delay: 0.2 },
  { label: 'On-chain Record', icon: 'shield-check', x: 180, y: 80, delay: 0.3 },
] as const

const ICON_PATHS: Record<string, string> = {
  search: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
  zap: 'M13 10V3L4 14h7v7l9-11h-7z',
  brain: 'M12 2a7 7 0 00-7 7c0 2.5 1.5 4.5 3 6v2a2 2 0 002 2h4a2 2 0 002-2v-2c1.5-1.5 3-3.5 3-6a7 7 0 00-7-7zm0 18v-1',
  'shield-check': 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z M9 12l2 2 4-4',
}

export function Hero(handle: Handle<Record<string, never>>) {
  return () => (
    <div mix={heroContainer}>
      <nav mix={nav}>
        <div mix={navLogo}>
          <span mix={logoText}>Selbo</span>
          <span mix={logoBadge}>AI TRADING AGENT</span>
        </div>
        <div mix={navLinks}>
          <a href="#how-it-works" mix={navLink}>How it works</a>
          <a href="#transparency" mix={navLink}>Transparency</a>
          <a href="#faq" mix={navLink}>FAQ</a>
          <a href="#request-access" mix={navCta}>Request Beta Access</a>
        </div>
      </nav>

      <section mix={heroSection}>
        <div mix={heroContent}>
          <div mix={tagline}>
            <span mix={taglineDot}>AUTOMATED.</span>
            <span mix={taglineDot}>TRANSPARENT.</span>
            <span mix={taglineText}>ON-CHAIN.</span>
          </div>

          <h1 mix={heroTitle}>
            Your AI trader,<br />
            with every decision<br />
            recorded <span mix={heroHighlight}>on-chain.</span>
          </h1>

          <p mix={heroDescription}>
            Selbo is an autonomous agent that monitors markets,<br />
            makes decisions, and executes trades — following<br />
            rules you set. Every action is recorded on-chain<br />
            so you can verify it anytime.
          </p>

          <div mix={heroActions}>
            <a href="#request-access" mix={primaryCta}>
              Request Beta Access
              <span mix={ctaArrow}>→</span>
            </a>
            <a href="#how-it-works" mix={secondaryCta}>
              See How It Works
              <span mix={ctaArrow}>→</span>
            </a>
          </div>

          <div mix={trustIndicators}>
            <span mix={trustItem}>
              <i class="ph ph-shield-check" mix={trustIcon}></i>
              Non-custodial
            </span>
            <span mix={trustDot}>•</span>
            <span mix={trustItem}>You stay in control</span>
            <span mix={trustDot}>•</span>
            <span mix={trustItem}>No profit guarantees</span>
          </div>
        </div>

        <div mix={heroVisual}>
          <div mix={hexContainer}>
            <svg viewBox="0 0 240 260" mix={hexShape}>
              <defs>
                <linearGradient id="hexTop" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#1a3a4a" />
                  <stop offset="100%" stopColor="#0d1f2d" />
                </linearGradient>
                <linearGradient id="hexLeft" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#0a1a24" />
                  <stop offset="100%" stopColor="#060f16" />
                </linearGradient>
                <linearGradient id="hexRight" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#0d2230" />
                  <stop offset="100%" stopColor="#081820" />
                </linearGradient>
                <linearGradient id="hexEdge" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#00d4ff" stopOpacity="0.4" />
                  <stop offset="50%" stopColor="#00d4ff" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="#00d4ff" stopOpacity="0.4" />
                </linearGradient>
                <filter id="glow">
                  <feGaussianBlur stdDeviation="4" result="coloredBlur" />
                  <feMerge>
                    <feMergeNode in="coloredBlur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
                <filter id="innerGlow">
                  <feGaussianBlur stdDeviation="2" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>
              
              {/* Bottom depth layer */}
              <path
                d="M120 180 L190 220 L190 260 L120 300 L50 260 L50 220 Z"
                fill="#060f16"
                opacity="0.8"
              />
              
              {/* Left side face */}
              <path
                d="M120 160 L50 200 L50 260 L120 300 Z"
                fill="url(#hexLeft)"
              />
              
              {/* Right side face */}
              <path
                d="M120 160 L190 200 L190 260 L120 300 Z"
                fill="url(#hexRight)"
              />
              
              {/* Top face - main */}
              <path
                d="M120 80 L190 120 L190 200 L120 240 L50 200 L50 120 Z"
                fill="url(#hexTop)"
                stroke="url(#hexEdge)"
                strokeWidth="1.5"
                filter="url(#glow)"
              />
              
              {/* Inner hexagon detail */}
              <path
                d="M120 110 L160 135 L160 185 L120 210 L80 185 L80 135 Z"
                fill="none"
                stroke="#00d4ff"
                strokeWidth="0.5"
                strokeOpacity="0.3"
              />
              
              {/* Chart line */}
              <polyline
                points="85,175 100,160 115,170 130,145 145,155 160,140"
                fill="none"
                stroke="#00d4ff"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                filter="url(#innerGlow)"
              />
              
              {/* Glow dots on chart line */}
              <circle cx="100" cy="160" r="2" fill="#00d4ff" opacity="0.8" />
              <circle cx="130" cy="145" r="2" fill="#00d4ff" opacity="0.8" />
              <circle cx="160" cy="140" r="2" fill="#00d4ff" opacity="0.8" />
            </svg>
          </div>

          <svg mix={connectionLines} viewBox="0 0 400 250">
            <path
              d="M50,125 Q200,50 200,125"
              fill="none"
              stroke="#00d4ff"
              strokeWidth="1"
              strokeDasharray="4,4"
              strokeOpacity="0.3"
            />
            <path
              d="M50,125 Q200,200 200,125"
              fill="none"
              stroke="#00d4ff"
              strokeWidth="1"
              strokeDasharray="4,4"
              strokeOpacity="0.3"
            />
            <path
              d="M350,125 Q200,50 200,125"
              fill="none"
              stroke="#00d4ff"
              strokeWidth="1"
              strokeDasharray="4,4"
              strokeOpacity="0.3"
            />
            <path
              d="M350,125 Q200,200 200,125"
              fill="none"
              stroke="#00d4ff"
              strokeWidth="1"
              strokeDasharray="4,4"
              strokeOpacity="0.3"
            />
          </svg>

          {FLOATING_ICONS.map((item) => (
            <div
              key={item.label}
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: `translate(${item.x}px, ${item.y}px)`,
                animationDelay: `${item.delay}s`,
              }}
              mix={floatingIcon}
            >
              <div mix={iconCircle}>
                <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#00d4ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d={ICON_PATHS[item.icon]} />
                </svg>
              </div>
              <span mix={iconLabel}>{item.label}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

const heroContainer = css({
  minHeight: '100vh',
  backgroundColor: '#0a0e14',
  color: '#ffffff',
  fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, sans-serif',
  overflow: 'hidden',
  position: 'relative',
})

const nav = css({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '20px 48px',
  maxWidth: '1280px',
  margin: '0 auto',
})

const navLogo = css({
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
})

const logoText = css({
  fontSize: '24px',
  fontWeight: '700',
  letterSpacing: '-0.5px',
})

const logoBadge = css({
  fontSize: '10px',
  fontWeight: '600',
  color: '#00d4ff',
  letterSpacing: '1.5px',
  padding: '4px 8px',
  border: '1px solid rgba(0, 212, 255, 0.3)',
  borderRadius: '4px',
})

const navLinks = css({
  display: 'flex',
  alignItems: 'center',
  gap: '32px',
})

const navLink = css({
  color: '#8892a4',
  textDecoration: 'none',
  fontSize: '14px',
  fontWeight: '500',
  transition: 'color 0.2s',
  ':hover': { color: '#ffffff' },
})

const navCta = css({
  backgroundColor: '#00d4ff',
  color: '#0a0e14',
  padding: '10px 20px',
  borderRadius: '6px',
  textDecoration: 'none',
  fontSize: '14px',
  fontWeight: '600',
  transition: 'transform 0.2s, box-shadow 0.2s',
  ':hover': {
    transform: 'translateY(-1px)',
    boxShadow: '0 4px 12px rgba(0, 212, 255, 0.3)',
  },
})

const heroSection = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '60px 48px 80px',
  maxWidth: '1280px',
  margin: '0 auto',
  gap: '60px',
})

const heroContent = css({
  flex: '0 0 45%',
  maxWidth: '520px',
})

const tagline = css({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '8px',
  padding: '8px 16px',
  border: '1px solid rgba(0, 212, 255, 0.3)',
  borderRadius: '24px',
  marginBottom: '32px',
  fontSize: '11px',
  fontWeight: '600',
  letterSpacing: '1.5px',
  color: '#8892a4',
})

const taglineDot = css({
  color: '#8892a4',
})

const taglineText = css({
  color: '#00d4ff',
})

const heroTitle = css({
  fontSize: '48px',
  fontWeight: '700',
  lineHeight: '1.1',
  letterSpacing: '-1px',
  marginBottom: '24px',
  margin: 0,
})

const heroHighlight = css({
  color: '#00d4ff',
})

const heroDescription = css({
  fontSize: '16px',
  lineHeight: '1.6',
  color: '#8892a4',
  marginBottom: '32px',
  margin: 0,
})

const heroActions = css({
  display: 'flex',
  gap: '16px',
  marginBottom: '32px',
})

const primaryCta = css({
  backgroundColor: '#00d4ff',
  color: '#0a0e14',
  padding: '14px 28px',
  borderRadius: '6px',
  textDecoration: 'none',
  fontSize: '15px',
  fontWeight: '600',
  display: 'inline-flex',
  alignItems: 'center',
  gap: '8px',
  transition: 'transform 0.2s, box-shadow 0.2s',
  ':hover': {
    transform: 'translateY(-2px)',
    boxShadow: '0 8px 20px rgba(0, 212, 255, 0.4)',
  },
})

const secondaryCta = css({
  backgroundColor: 'transparent',
  color: '#ffffff',
  padding: '14px 28px',
  borderRadius: '6px',
  border: '1px solid rgba(255, 255, 255, 0.2)',
  textDecoration: 'none',
  fontSize: '15px',
  fontWeight: '600',
  display: 'inline-flex',
  alignItems: 'center',
  gap: '8px',
  transition: 'border-color 0.2s',
  ':hover': { borderColor: 'rgba(255, 255, 255, 0.4)' },
})

const ctaArrow = css({
  fontSize: '18px',
})

const trustIndicators = css({
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  fontSize: '13px',
  color: '#8892a4',
})

const trustItem = css({
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
})

const trustIcon = css({
  fontSize: '16px',
  color: '#00d4ff',
})

const trustDot = css({
  color: '#8892a4',
})

const heroVisual = css({
  flex: '0 0 50%',
  position: 'relative',
  height: '400px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
})

const hexContainer = css({
  width: '240px',
  height: '260px',
  position: 'relative',
  zIndex: 2,
})

const hexShape = css({
  width: '100%',
  height: '100%',
  filter: 'drop-shadow(0 0 20px rgba(0, 212, 255, 0.3))',
})

const connectionLines = css({
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: '400px',
  height: '250px',
  zIndex: 1,
})

const floatingIcon = css({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '8px',
  zIndex: 3,
  animation: 'float 3s ease-in-out infinite',
})

const iconCircle = css({
  width: '48px',
  height: '48px',
  borderRadius: '12px',
  backgroundColor: 'rgba(0, 212, 255, 0.1)',
  border: '1px solid rgba(0, 212, 255, 0.2)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
})

const iconLabel = css({
  fontSize: '12px',
  fontWeight: '500',
  color: '#8892a4',
  whiteSpace: 'nowrap',
})
