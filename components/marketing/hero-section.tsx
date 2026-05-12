/**
 * Brutalist trader hero. Pure black canvas, CRT scanlines, typewriter
 * headline with blinking caret, pulsing TESTNET status, two terminal-bracket
 * CTAs. No framer-motion — Tailwind keyframes only.
 */

import Link from "next/link";
import { TickerTape } from "./ticker-tape";

export function HeroSection() {
  return (
    <section className="scanlines relative isolate w-full overflow-hidden border-b border-[var(--hairline-strong)]">
      <TickerTape />

      {/* Status indicator — hidden on mobile to avoid headline overlap */}
      <div className="absolute right-4 top-14 z-20 hidden items-center gap-2 border border-[var(--hairline-strong)] bg-black px-3 py-1.5 text-[10px] uppercase tracking-[0.2em] sm:right-6 sm:top-16 sm:flex">
        <span className="relative inline-flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-pulse-dot rounded-full bg-[var(--neon-green)]" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[var(--neon-green)]" />
        </span>
        <span className="text-[var(--neon-green)]">TESTNET</span>
        <span className="text-muted-foreground">·</span>
        <span>LIVE</span>
      </div>

      <div className="relative z-10 mx-auto flex min-h-[80vh] max-w-6xl flex-col justify-center px-6 py-24 md:py-32">
        {/* Eyebrow */}
        <div className="mb-6 flex flex-wrap items-center gap-3 text-[10px] uppercase tracking-[0.3em] text-muted-foreground sm:text-xs">
          <span className="inline-block h-px w-6 bg-[var(--neon-cyan)] sm:w-8" />
          <span>// Solon · public AI trader · Circle × Arc</span>
        </div>

        {/* Headline — typewriter with caret */}
        <h1 className="mb-6 text-[clamp(34px,8vw,88px)] font-bold uppercase leading-[0.95] tracking-tight text-balance">
          <span className="block">
            <span className="inline-block animate-typing overflow-hidden whitespace-nowrap align-bottom">
              Deploy your
            </span>
          </span>
          <span className="block">
            <span className="text-[var(--neon-cyan)]">AI</span>{" "}
            <span>trader.</span>
            <span className="ml-1 inline-block h-[0.9em] w-[0.4em] translate-y-[2px] animate-blink bg-[var(--neon-cyan)] align-bottom" />
          </span>
        </h1>

        {/* Subtitle — tighter */}
        <p className="max-w-2xl text-balance text-base text-muted-foreground sm:text-lg">
          Three specialist AI agents debate every trade. A cross-model auditor
          reviews the debate. <span className="text-foreground">Every decision and every dissent</span> gets anchored on Arc.
          You can read all of it.
        </p>

        {/* CTAs */}
        <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Link
            href="/sign-up"
            className="group inline-flex items-center justify-center gap-3 border border-[var(--neon-cyan)] bg-black px-6 py-4 text-xs font-bold uppercase tracking-[0.18em] text-[var(--neon-cyan)] transition hover:bg-[var(--neon-cyan)] hover:text-black focus:outline-none focus:ring-2 focus:ring-[var(--neon-cyan)] focus:ring-offset-2 focus:ring-offset-black sm:text-sm"
          >
            <span className="opacity-60 group-hover:opacity-100">[</span>
            <span>Deploy your Solon</span>
            <span className="opacity-60 group-hover:opacity-100">→]</span>
          </Link>
          <Link
            href="/solon/jagrit"
            className="inline-flex items-center justify-center gap-2 border border-[var(--hairline-strong)] bg-transparent px-6 py-4 text-xs font-bold uppercase tracking-[0.18em] text-foreground transition hover:border-foreground sm:text-sm"
          >
            <span>Watch Jagrit&apos;s flagship</span>
            <span className="opacity-50">↗</span>
          </Link>
        </div>

        {/* Bottom meta strip */}
        <div className="mt-16 grid max-w-3xl grid-cols-2 gap-px border border-[var(--hairline)] bg-[var(--hairline)] text-xs sm:grid-cols-4">
          {[
            { k: "STACK", v: "Circle · Arc" },
            { k: "AUDIT", v: "Cross-model" },
            { k: "MODE", v: "Simulation" },
            { k: "OPEN", v: "Open beta" },
          ].map((m) => (
            <div key={m.k} className="bg-black px-4 py-3">
              <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                {m.k}
              </div>
              <div className="mt-1 text-foreground">{m.v}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
