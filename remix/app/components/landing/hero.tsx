import type { Handle } from 'remix/ui'
import { css } from 'remix/ui'
import { routes } from '../../routes.ts'

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
          <div mix={contentGroup}>
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
              makes decisions, and executes trades - following<br />
              rules you set. Every action is recorded on-chain<br />
              so you can verify it anytime.
            </p>
          </div>

          <div mix={actionGroup}>
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
              <span mix={trustItem}>
                <i class="ph ph-hand-soap" mix={trustIcon}></i>
                You stay in control
              </span>
              <span mix={trustItem}>
                <i class="ph ph-chart-line-down" mix={trustIcon}></i>
                No profit guarantees
              </span>
            </div>
          </div>
        </div>

        <div mix={heroVisual}>
          <div id="hex-3d" style={{ width: '100%', height: '100%' }} />
        </div>
      </section>

      <script
        type="module"
        src={routes.assets.href({ path: 'app/assets/hex-three-client.ts' })}
      />
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
  padding: '0 48px',
})

const nav = css({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '20px 0',
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
  padding: '12px 24px',
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
  padding: '60px 0 80px',
  gap: '60px',
})

const heroContent = css({
  flex: '0 0 45%',
  maxWidth: '520px',
  display: 'flex',
  flexDirection: 'column',
  gap: '48px',
})

const contentGroup = css({
  display: 'flex',
  flexDirection: 'column',
})

const actionGroup = css({
  display: 'flex',
  flexDirection: 'column',
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
  marginBottom: '16px',
})

const heroHighlight = css({
  color: '#00d4ff',
})

const heroDescription = css({
  fontSize: '16px',
  lineHeight: '1.6',
  color: '#8892a4',
})

const heroActions = css({
  display: 'flex',
  gap: '16px',
})

const primaryCta = css({
  backgroundColor: '#00d4ff',
  color: '#0a0e14',
  padding: '16px 32px',
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
  padding: '16px 32px',
  borderRadius: '6px',
  outline: '1px solid rgba(255, 255, 255, 0.2)',
  textDecoration: 'none',
  fontSize: '15px',
  fontWeight: '600',
  display: 'inline-flex',
  alignItems: 'center',
  gap: '8px',
  transition: 'outline-color 0.2s',
  ':hover': { outlineColor: 'rgba(255, 255, 255, 0.4)' },
})

const ctaArrow = css({
  fontSize: '18px',
})

const trustIndicators = css({
  display: 'flex',
  alignItems: 'center',
  gap: '24px',
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

const heroVisual = css({
  flex: '1',
  position: 'relative',
  height: '500px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
})
