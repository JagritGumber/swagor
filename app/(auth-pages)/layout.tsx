import Link from "next/link";
import { ArrowLeft } from "lucide-react";

/**
 * Auth pages shell. Full-bleed dotted-cyan radial background mirrors the
 * landing hero so signin/signup feel like the same product. Centered card
 * slot; brand at top; terms footer at bottom.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative isolate min-h-[calc(100vh-4rem)] -mt-24 pt-24 w-full overflow-hidden">
      <div
        aria-hidden
        className="dot-drift pointer-events-none absolute inset-0 z-0"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(0, 212, 255, 0.22) 1px, transparent 1.5px)",
          backgroundSize: "26px 26px",
          maskImage:
            "radial-gradient(ellipse 60% 50% at 50% 40%, black 0%, transparent 75%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 60% 50% at 50% 40%, black 0%, transparent 75%)",
          opacity: 0.45,
        }}
      />

      <Link
        href="/"
        className="absolute left-6 top-20 z-10 inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground hover:text-[var(--neon-cyan)]"
      >
        <ArrowLeft aria-hidden className="h-3.5 w-3.5" />
        Home
      </Link>

      <main className="relative z-10 mx-auto flex min-h-[calc(100vh-6rem)] w-full max-w-md flex-col items-center justify-center gap-8 px-6 py-12">
        <div className="text-center">
          <div className="text-3xl font-bold tracking-tight text-foreground">
            Solon
          </div>
          <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            Public AI crypto trader · on Arc
          </p>
        </div>

        {children}

        <p className="text-center text-xs text-muted-foreground/70">
          By continuing you agree to our{" "}
          <Link href="/terms" className="underline underline-offset-4 hover:text-foreground">
            Terms
          </Link>{" "}
          and{" "}
          <Link href="/terms" className="underline underline-offset-4 hover:text-foreground">
            Privacy Policy
          </Link>
          .
        </p>
      </main>
    </div>
  );
}
