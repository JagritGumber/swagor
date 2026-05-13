/**
 * Hero. Right-side Paper Shaders Warp dithering, mask-faded into the page
 * on the left. Typewriter headline + caret + ticker on top.
 */

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Dithering } from "@paper-design/shaders-react";
import { TickerTape } from "./ticker-tape";

export function HeroSection() {
  return (
    <section className="scanlines relative isolate w-full overflow-hidden border-b border-[var(--hairline-strong)]">
      <TickerTape />

      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 z-0 w-2/3 [mask-image:radial-gradient(ellipse_at_100%_50%,black_0%,transparent_75%)] [-webkit-mask-image:radial-gradient(ellipse_at_100%_50%,black_0%,transparent_75%)]"
      >
        <Dithering
          colorBack="#000000"
          colorFront="#00d4ff"
          shape="warp"
          type="4x4"
          size={2}
          speed={0.6}
          scale={0.8}
          style={{ width: "100%", height: "100%" }}
        />
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen max-w-6xl flex-col justify-center px-6 py-24 md:py-32">
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

        <p className="max-w-2xl text-balance text-base text-muted-foreground sm:text-lg">
          Three specialist AI agents debate every trade. A cross-model auditor
          reviews the debate. <span className="text-foreground">Every decision and every dissent</span> gets anchored on Arc.
          You can read all of it.
        </p>

        <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Link
            href="/sign-up"
            className="cta-glow group inline-flex items-center justify-center gap-3 border border-[var(--neon-cyan)] bg-[var(--neon-cyan)] px-6 py-4 text-xs font-bold uppercase tracking-[0.18em] text-black hover:bg-black hover:text-[var(--neon-cyan)] focus:outline-none focus:ring-2 focus:ring-[var(--neon-cyan)] focus:ring-offset-2 focus:ring-offset-black sm:text-sm"
          >
            <span>Deploy your Solon</span>
            <ArrowRight aria-hidden className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
          <Link
            href="/solon/jagrit"
            className="group inline-flex items-center justify-center gap-2 border border-[var(--hairline-strong)] bg-transparent px-6 py-4 text-xs font-bold uppercase tracking-[0.18em] text-foreground transition hover:border-foreground sm:text-sm"
          >
            <span>Watch our flagship</span>
            <ArrowRight aria-hidden className="h-4 w-4 opacity-60 transition-transform group-hover:translate-x-1" />
          </Link>
        </div>
      </div>
    </section>
  );
}
