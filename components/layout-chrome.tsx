"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import HeaderAuth from "@/components/header-auth";
import { NavBrand } from "@/components/nav-brand";

const DASHBOARD_TABS: Array<{ href: string; label: string; match: (p: string) => boolean }> = [
  { href: "/dashboard", label: "Dashboard", match: (p) => p === "/dashboard" },
  { href: "/dashboard/brain", label: "Brain", match: (p) => p.startsWith("/dashboard/brain") },
];

function DashboardTabs({ path }: { path: string }) {
  return (
    <div className="flex items-center justify-center gap-6">
      {DASHBOARD_TABS.map((t) => {
        const active = t.match(path);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`font-mono text-[11px] font-bold uppercase tracking-[0.18em] transition ${
              active
                ? "text-[var(--neon-cyan)]"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}

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
      <div className="mx-auto grid h-full max-w-7xl grid-cols-3 items-center text-sm">
        <div className="flex items-baseline gap-4">
          <NavBrand />
          <span className="hidden font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground sm:inline">
            testnet
          </span>
        </div>
        <DashboardTabs path={path ?? "/dashboard"} />
        <div className="flex items-center justify-end gap-3">
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
