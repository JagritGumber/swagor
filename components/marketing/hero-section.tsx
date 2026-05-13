import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { TickerTape } from "./ticker-tape";
import { SectionShader } from "./shaders/section-shader";

export function HeroSection() {
  return (
    <section className="scanlines relative isolate w-full overflow-hidden border-b border-[var(--hairline-strong)] bg-black">
      <SectionShader variant="dithering-warp" opacity={0.9} scrim={0} />
      <TickerTape />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-6xl items-stretch px-6">
        <div className="flex w-full max-w-3xl flex-col border-l border-r border-[var(--neon-cyan)]">
          <div className="flex-1 bg-black/35 backdrop-blur-md" aria-hidden />

          <div className="border-y border-[var(--neon-cyan)] bg-black/85 px-8 py-12 backdrop-blur-sm md:px-14 md:py-16">
            <h1 className="mb-6 text-[clamp(34px,8vw,88px)] font-bold uppercase leading-[0.95] tracking-tight text-balance">
              <span
                className="block"
                style={{ animation: "rise-in 0.7s cubic-bezier(0.16,1,0.3,1) 0ms both" }}
              >
                Deploy your
              </span>
              <span
                className="block"
                style={{ animation: "rise-in 0.7s cubic-bezier(0.16,1,0.3,1) 220ms both" }}
              >
                <span className="text-[var(--neon-cyan)]">AI</span>{" "}
                <span>trader.</span>
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
                style={{ willChange: "transform" }}
                className="cta-glow group inline-flex items-center justify-center gap-3 border border-[var(--neon-cyan)] bg-[var(--neon-cyan)] px-6 py-4 text-xs font-bold uppercase tracking-[0.18em] text-black hover:bg-black hover:text-[var(--neon-cyan)] focus:outline-none focus:ring-2 focus:ring-[var(--neon-cyan)] focus:ring-offset-2 focus:ring-offset-black sm:text-sm"
              >
                <span>Deploy your Selbo</span>
                <ArrowRight aria-hidden className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
              <Link
                href="/selbo/jagrit"
                style={{ willChange: "transform" }}
                className="group inline-flex items-center justify-center gap-2 border border-[var(--hairline-strong)] bg-transparent px-6 py-4 text-xs font-bold uppercase tracking-[0.18em] text-foreground transition hover:border-foreground sm:text-sm"
              >
                <span>Watch our flagship</span>
                <ArrowRight aria-hidden className="h-4 w-4 opacity-60 transition-transform group-hover:translate-x-1" />
              </Link>
            </div>
          </div>

          <div className="flex-1 bg-black/35 backdrop-blur-md" aria-hidden />
        </div>
      </div>
    </section>
  );
}
