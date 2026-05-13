"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft } from "lucide-react";

const AUTH_PATHS = ["/sign-in", "/sign-up", "/forgot-password"];

/**
 * Nav brand mark. Pathname-aware:
 *  - On marketing / dashboard pages: "Solon" wordmark with cyan underline reveal on hover.
 *  - On auth pages: "[arrow] Home" back link in the same slot, same size, same x.
 * Both link to "/" — the swap is purely about giving auth pages a clear way back.
 */
export function NavBrand() {
  const pathname = usePathname();
  const onAuth = AUTH_PATHS.some((p) => pathname?.startsWith(p));

  if (onAuth) {
    return (
      <Link
        href="/"
        aria-label="Back to home"
        className="inline-flex items-center gap-2 text-2xl font-bold tracking-tight text-foreground transition hover:text-[var(--neon-cyan)]"
      >
        <ArrowLeft aria-hidden className="h-5 w-5" />
        Home
      </Link>
    );
  }

  return (
    <Link
      href="/"
      aria-label="Solon home"
      className="group relative text-2xl font-bold tracking-tight text-foreground"
    >
      Solon
      <span
        aria-hidden
        className="pointer-events-none absolute -bottom-1 left-0 h-px w-full origin-left scale-x-0 bg-[var(--neon-cyan)] transition-transform duration-300 ease-out group-hover:scale-x-100"
      />
    </Link>
  );
}
