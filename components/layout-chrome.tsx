"use client";

import { usePathname } from "next/navigation";
import HeaderAuth from "@/components/header-auth";
import { NavBrand } from "@/components/nav-brand";

/**
 * Width + padding for navbar / footer. Dashboard pages use max-w-7xl
 * with NO inner padding so the navbar content sits flush with the
 * dashboard cards (which also have no horizontal padding inside their
 * max-w-7xl wrapper). Marketing / legal / other pages keep the
 * previous max-w-6xl + px-6 because the user liked that layout.
 */
function useChromeClass(): string {
  const path = usePathname();
  if (path?.startsWith("/dashboard")) return "max-w-7xl px-0";
  return "max-w-6xl px-6";
}

export function NavInner() {
  const cls = useChromeClass();
  return (
    <div className={`mx-auto flex h-full ${cls} items-center justify-between text-sm`}>
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
  const cls = useChromeClass();
  return (
    <div className={`mx-auto flex ${cls} flex-wrap items-center justify-between gap-3 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground`}>
      <span>Selbo · paper mode · testnet</span>
      <a href="/legal/disclaimer" className="hover:text-[var(--neon-cyan)]">
        Disclaimer
      </a>
    </div>
  );
}
