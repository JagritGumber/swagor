/**
 * Final CTA with corner brackets + footer with brand row and 2-col grid.
 * Selbo wordmark has no dot prefix in footer. "Watch our flagship" copy.
 * Stronger separator color so the brand row break is visible.
 */

import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
// ArrowUpRight remains for the genuinely-external Arc Testnet explorer link.
import { LEGAL_DISCLOSURE_LONG } from "@/lib/marketing-data";

export function CtaFooter() {
  return (
    <>
      <section className="relative isolate overflow-hidden border-b border-[var(--hairline-strong)] bg-black">
        <div className="mx-auto max-w-6xl px-6 py-16 text-center sm:py-20">
          <h2 className="text-[40px] font-bold uppercase leading-[0.95] tracking-tight text-balance text-foreground">
            Deploy your <span className="text-[var(--neon-cyan)]">Selbo</span>.
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-muted-foreground">
            Sign in. Get a Circle wallet on Arc. Write your strategy in plain English. <span className="text-foreground">Your AI is cycling within ninety seconds.</span>
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/sign-up"
              className="cta-glow group inline-flex items-center gap-3 border border-[var(--neon-cyan)] bg-[var(--neon-cyan)] px-8 py-5 text-sm font-bold uppercase tracking-[0.2em] text-black hover:bg-black hover:text-[var(--neon-cyan)]"
            >
              <span>Deploy your Selbo</span>
              <ArrowRight aria-hidden className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link
              href="/selbo/jagrit"
              className="group inline-flex items-center gap-2 border border-[var(--hairline-strong)] px-8 py-5 text-sm font-bold uppercase tracking-[0.2em] text-foreground transition hover:border-foreground"
            >
              <span>Watch our flagship</span>
              <ArrowRight aria-hidden className="h-4 w-4 opacity-60 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
        </div>

        <span aria-hidden className="pointer-events-none absolute left-4 top-4 h-6 w-6 border-l border-t border-[var(--neon-cyan)]" />
        <span aria-hidden className="pointer-events-none absolute right-4 top-4 h-6 w-6 border-r border-t border-[var(--neon-cyan)]" />
        <span aria-hidden className="pointer-events-none absolute bottom-4 left-4 h-6 w-6 border-b border-l border-[var(--neon-cyan)]" />
        <span aria-hidden className="pointer-events-none absolute bottom-4 right-4 h-6 w-6 border-b border-r border-[var(--neon-cyan)]" />
      </section>

      <footer className="bg-black py-10 sm:py-12">
        <div className="mx-auto max-w-6xl px-6">
          {/* Brand row */}
          <div className="border-b border-[var(--hairline-strong)] pb-6">
            <div className="text-2xl font-bold tracking-tight text-foreground">
              Selbo
            </div>
            <p className="mt-2 max-w-2xl text-base text-muted-foreground">
              Public AI crypto trader. Built on Circle. Recorded on Arc.
            </p>
          </div>

          {/* 2-col grid */}
          <div className="grid gap-10 pt-8 text-sm sm:grid-cols-2">
            <div>
              <div className="font-mono font-bold uppercase tracking-[0.25em] text-muted-foreground">
                Disclosure
              </div>
              <p className="mt-3 text-muted-foreground">
                {LEGAL_DISCLOSURE_LONG}
              </p>
            </div>
            <div>
              <div className="font-mono font-bold uppercase tracking-[0.25em] text-muted-foreground">
                Links
              </div>
              <ul className="mt-3 space-y-2">
                <li>
                  <Link href="/selbo/jagrit" className="text-muted-foreground hover:text-foreground">
                    Watch our flagship
                  </Link>
                </li>
                <li>
                  <Link href="/terms" className="text-muted-foreground hover:text-foreground">
                    Terms
                  </Link>
                </li>
                <li>
                  <a
                    href="https://testnet.arcscan.app"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground"
                  >
                    <span>Arc Testnet explorer</span>
                    <ArrowUpRight aria-hidden className="h-3.5 w-3.5 opacity-70" />
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <div className="mt-10 border-t border-[var(--hairline-strong)] pt-4 font-mono text-xs uppercase tracking-[0.25em] text-muted-foreground">
            © 2026 Selbo
          </div>
        </div>
      </footer>
    </>
  );
}
