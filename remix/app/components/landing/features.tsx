import type { Handle } from 'remix/ui'
import { css } from 'remix/ui'

export function Features(handle: Handle<Record<string, never>>) {
  return () => (
    <section mix={featuresSection}>
      <div mix={featuresInner}>
        <div mix={featureCard}>
          <i class="ph ph-shield-check" mix={featureIcon}></i>
          <h3 mix={featureTitle}>Non-custodial</h3>
          <p mix={featureText}>
            Your funds never leave your wallet. Selbo reads markets and
            executes through your signed permissions — full control stays with you.
          </p>
        </div>

        <div mix={featureCard}>
          <i class="ph ph-notebook" mix={featureIcon}></i>
          <h3 mix={featureTitle}>On-chain verified</h3>
          <p mix={featureText}>
            Every decision, every execution is recorded on-chain.
            No black box — inspect the full audit trail anytime.
          </p>
        </div>

        <div mix={featureCard}>
          <i class="ph ph-sliders" mix={featureIcon}></i>
          <h3 mix={featureTitle}>Programmable rules</h3>
          <p mix={featureText}>
            Set your own parameters — risk limits, asset preferences,
            execution windows. Your agent follows the rules you define.
          </p>
        </div>
      </div>
    </section>
  )
}

const featuresSection = css({
  backgroundColor: '#0a0e14',
  padding: '64px 48px',
  borderTop: '1px solid rgba(255, 255, 255, 0.06)',
})

const featuresInner = css({
  display: 'flex',
  gap: '48px',
  maxWidth: '1280px',
  margin: '0 auto',
})

const featureCard = css({
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  gap: '16px',
})

const featureIcon = css({
  fontSize: '24px',
  color: '#00d4ff',
})

const featureTitle = css({
  fontSize: '18px',
  fontWeight: '600',
  color: '#ffffff',
})

const featureText = css({
  fontSize: '14px',
  lineHeight: '1.6',
  color: '#8892a4',
})
