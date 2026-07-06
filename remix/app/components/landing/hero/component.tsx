import type { Handle } from 'remix/ui'
import { routes } from '../../../routes.ts'

import * as s from './style.ts'

export function Hero(handle: Handle<Record<string, never>>) {
  return () => (
    <div mix={s.heroContainer}>
      <section mix={s.heroSection}>
        <div mix={s.heroContent}>
          <div mix={s.contentGroup}>
            <div mix={s.tagline}>
              <span mix={s.taglineDot}>AUTOMATED.</span>
              <span mix={s.taglineDot}>TRANSPARENT.</span>
              <span mix={s.taglineText}>ON-CHAIN.</span>
            </div>

            <h1 mix={s.heroTitle}>
              Your AI trader,<br />
              with every decision<br />
              recorded <span mix={s.heroHighlight}>on-chain.</span>
            </h1>

            <p mix={s.heroDescription}>
              Selbo is an autonomous agent that monitors markets,<br />
              makes decisions, and executes trades - following<br />
              rules you set. Every action is recorded on-chain<br />
              so you can verify it anytime.
            </p>
          </div>

          <div mix={s.actionGroup}>
            <div mix={s.heroActions}>
              <a href="#request-access" mix={s.primaryCta}>
                Request Beta Access
                <span mix={s.ctaArrow}>→</span>
              </a>
              <a href="#how-it-works" mix={s.secondaryCta}>
                See How It Works
                <span mix={s.ctaArrow}>→</span>
              </a>
            </div>

            <div mix={s.trustIndicators}>
              <span mix={s.trustItem}>
                <i class="ph ph-shield-check" mix={s.trustIcon}></i>
                Non-custodial
              </span>
              <span mix={s.trustItem}>
                <i class="ph ph-hand-soap" mix={s.trustIcon}></i>
                You stay in control
              </span>
              <span mix={s.trustItem}>
                <i class="ph ph-chart-line-down" mix={s.trustIcon}></i>
                No profit guarantees
              </span>
            </div>
          </div>
        </div>

        <div mix={s.heroVisual}>
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
