/**
 * Final CTA + disclaimer footer. Brutalist trader closing pitch.
 */

import Link from "next/link";

export function CtaFooter() {
  return (
    <>
      <section className="relative isolate overflow-hidden border-b border-[var(--hairline-strong)] bg-black">
        <div className="mx-auto max-w-6xl px-6 py-24 text-center">
          <div className="text-xs uppercase tracking-[0.3em] text-[var(--neon-cyan)]">
            // Ready when you are
          </div>
          <h2 className="mt-4 text-4xl font-bold uppercase tracking-tight md:text-7xl">
            Deploy your <span className="text-[var(--neon-cyan)]">Solon</span>.
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-sm text-muted-foreground md:text-base">
            One click. Circle Dev Wallet auto-provisioned on Arc Testnet.
            Faucet-funded. Strategy in plain English. Your AI trader running
            within ninety seconds.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/sign-up"
              className="group inline-flex items-center gap-4 border border-[var(--neon-cyan)] bg-[var(--neon-cyan)] px-8 py-5 text-sm font-bold uppercase tracking-[0.2em] text-black transition hover:bg-black hover:text-[var(--neon-cyan)]"
            >
              <span>[ Deploy your Solon →]</span>
            </Link>
            <Link
              href="/solon/jagrit"
              className="inline-flex items-center gap-2 border border-[var(--hairline-strong)] px-8 py-5 text-sm font-bold uppercase tracking-[0.2em] text-foreground transition hover:border-foreground"
            >
              View Jagrit&apos;s flagship ↗
            </Link>
          </div>
        </div>

        {/* corner brackets */}
        <span aria-hidden className="pointer-events-none absolute left-4 top-4 h-6 w-6 border-l border-t border-[var(--neon-cyan)]" />
        <span aria-hidden className="pointer-events-none absolute right-4 top-4 h-6 w-6 border-r border-t border-[var(--neon-cyan)]" />
        <span aria-hidden className="pointer-events-none absolute bottom-4 left-4 h-6 w-6 border-b border-l border-[var(--neon-cyan)]" />
        <span aria-hidden className="pointer-events-none absolute bottom-4 right-4 h-6 w-6 border-b border-r border-[var(--neon-cyan)]" />
      </section>

      <footer className="bg-black py-12">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid gap-8 text-xs sm:grid-cols-3">
            <div>
              <div className="font-bold uppercase tracking-[0.25em] text-[var(--neon-cyan)]">
                SOLON
              </div>
              <p className="mt-3 text-muted-foreground">
                Public AI crypto trader. Built on Circle. Anchored on Arc.
              </p>
            </div>
            <div>
              <div className="font-bold uppercase tracking-[0.25em] text-muted-foreground">
                Disclaimer
              </div>
              <p className="mt-3 text-muted-foreground">
                Solon is an autonomous AI trading agent operating on Arc
                Testnet with simulated capital. No real funds are deployed.
                Public reasoning is for educational and entertainment purposes
                only. This is not investment advice.
              </p>
            </div>
            <div>
              <div className="font-bold uppercase tracking-[0.25em] text-muted-foreground">
                Links
              </div>
              <ul className="mt-3 space-y-1">
                <li>
                  <Link href="/solon/jagrit" className="text-muted-foreground hover:text-foreground">
                    Jagrit&apos;s flagship →
                  </Link>
                </li>
                <li>
                  <Link href="/terms" className="text-muted-foreground hover:text-foreground">
                    Terms →
                  </Link>
                </li>
                <li>
                  <a
                    href="https://testnet.arcscan.app"
                    target="_blank"
                    rel="noreferrer"
                    className="text-muted-foreground hover:text-foreground"
                  >
                    Arc Testnet explorer ↗
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <div className="mt-10 border-t border-[var(--hairline)] pt-4 text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
            © 2026 SOLON · BUILT FOR THE AGORA AGENTS HACKATHON
          </div>
        </div>
      </footer>
    </>
  );
}
