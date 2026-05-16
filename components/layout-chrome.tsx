"use client";

import { usePathname } from "next/navigation";
import HeaderAuth from "@/components/header-auth";
import { NavBrand } from "@/components/nav-brand";

/**
 * Width helper. Dashboard pages use a wider container (max-w-7xl)
 * to match the dashboard content; other pages keep the marketing
 * max-w-6xl so the navbar and footer don't suddenly look stretched.
 */
function useChromeMaxW(): "max-w-7xl" | "max-w-6xl" {
  const path = usePathname();
  return path?.startsWith("/dashboard") ? "max-w-7xl" : "max-w-6xl";
}

export function NavInner() {
  const maxW = useChromeMaxW();
  return (
    <div className={`mx-auto flex h-full ${maxW} items-center justify-between px-6 text-sm`}>
      <div className="flex items-baseline gap-4">
        <NavBrand />
        <span className="hidden font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground sm:inline">
          testnet
        </span>
      </div>
      <div className="flex items-center gap-3">
        <HeaderAuth />
      </div>
    </div>
  );
}

export function FooterInner() {
  const maxW = useChromeMaxW();
  return (
    <div className={`mx-auto flex ${maxW} flex-wrap items-center justify-between gap-3 px-6 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground`}>
      <span>Selbo · paper mode · testnet</span>
      <a href="/legal/disclaimer" className="hover:text-[var(--neon-cyan)]">
        Disclaimer
      </a>
    </div>
  );
}
