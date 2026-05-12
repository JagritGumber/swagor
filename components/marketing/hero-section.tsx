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

      {/* Status indicator */}
      <div className="absolute right-6 top-16 z-20 flex items-center gap-2 border border-[var(--hairline-strong)] bg-black px-3 py-1.5 text-[10px] uppercase tracking-[0.2em]">
        <span className="relative inline-flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-pulse-dot rounded-full bg-[var(--neon-green)]" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[var(--neon-green)]" />
        </span>
        <span className="text-[var(--neon-green)]">STATUS</span>
        <span className="text-muted-foreground">·</span>
        <span>TESTNET</span>
      </div>

      <div className="relative z-10 mx-auto flex min-h-[80vh] max-w-6xl flex-col justify-center px-6 py-24 md:py-32">
        {/* Eyebrow */}
        <div className="mb-6 flex items-center gap-3 text-xs uppercase tracking-[0.3em] text-muted-foreground">
          <span className="inline-block h-px w-8 bg-[var(--neon-cyan)]" />
          <span>// SOLON · PUBLIC AI TRADER · BUILT ON CIRCLE/ARC</span>
        </div>

        {/* Headline — typewriter with caret */}
        <h1 className="mb-6 text-[40px] font-bold uppercase leading-[0.95] tracking-tight md:text-[88px]">
          <span className="block">
            <span className="inline-block animate-typing overflow-hidden whitespace-nowrap align-bottom">
              DEPLOY YOUR
            </span>
          </span>
          <span className="block">
            <span className="text-[var(--neon-cyan)]">AI</span>{" "}
            <span>TRADER.</span>
            <span className="ml-1 inline-block h-[0.9em] w-[0.45em] translate-y-[2px] animate-blink bg-[var(--neon-cyan)] align-bottom" />
          </span>
        </h1>

        {/* Subtitle */}
        <p className="max-w-2xl text-base text-muted-foreground md:text-lg">
          Panel-reviewed AI trades, anchored on-chain. Every decision
          reasoned. Every reasoning trace anchored on Arc. Watch live, deploy
          yours, follow the council.
        </p>

        {/* CTAs */}
        <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Link
            href="/sign-up"
            className="group inline-flex items-center justify-between gap-4 border border-[var(--neon-cyan)] bg-black px-6 py-4 text-sm font-bold uppercase tracking-[0.15em] text-[var(--neon-cyan)] transition hover:bg-[var(--neon-cyan)] hover:text-black focus:outline-none focus:ring-2 focus:ring-[var(--neon-cyan)] focus:ring-offset-2 focus:ring-offset-black"
          >
            <span className="opacity-70 group-hover:opacity-100">[</span>
            <span>Deploy your Solon</span>
            <span className="opacity-70 group-hover:opacity-100">→]</span>
          </Link>
          <Link
            href="/solon/jagrit"
            className="inline-flex items-center justify-center gap-2 border border-[var(--hairline-strong)] bg-transparent px-6 py-4 text-sm font-bold uppercase tracking-[0.15em] text-foreground transition hover:border-foreground"
          >
            <span>View Jagrit&apos;s flagship</span>
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
