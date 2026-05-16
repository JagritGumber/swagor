"use client";

import { usePathname } from "next/navigation";
import HeaderAuth from "@/components/header-auth";
import { NavBrand } from "@/components/nav-brand";

/**
 * Per-route navbar / footer. Dashboard routes get the wider flush
 * container so the navbar content aligns with dashboard cards (which
 * also have no horizontal padding inside their max-w-7xl wrapper).
 * Every other route keeps the original max-w-6xl + px-6 layout
 * verbatim so marketing / legal / public pages render identically
 * to how they did before the dashboard work started.
 */
function isDashboardRoute(path: string | null): boolean {
  return path !== null && path.startsWith("/dashboard");
}

export function NavInner() {
  const path = usePathname();
  if (isDashboardRoute(path)) {
    return (
      <div className="mx-auto flex h-full max-w-7xl items-center justify-between text-sm">
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
  // Marketing / legal / public / landing -- ORIGINAL layout verbatim.
  return (
    <div className="mx-auto flex h-full max-w-6xl items-center justify-between px-6 text-sm">
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
  const path = usePathname();
  if (isDashboardRoute(path)) {
    return (
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        <span>Selbo · paper mode · testnet</span>
        <a href="/legal/disclaimer" className="hover:text-[var(--neon-cyan)]">
          Disclaimer
        </a>
      </div>
    );
  }
  // Marketing / legal / public / landing -- ORIGINAL footer verbatim.
  return (
    <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
      <span>Selbo · paper mode · testnet</span>
      <a href="/legal/disclaimer" className="hover:text-[var(--neon-cyan)]">
        Disclaimer
      </a>
    </div>
  );
}
