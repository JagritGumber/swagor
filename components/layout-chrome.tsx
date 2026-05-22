"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import HeaderAuth from "@/components/header-auth";
import { NavBrand } from "@/components/nav-brand";
import { SelboStatusPill } from "@/components/dashboard/selbo-status-pill";
import { AdminTogglePill } from "@/components/admin/admin-toggle-pill";

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
      <div className="mx-auto grid h-full max-w-7xl grid-cols-3 items-center px-4 xl:px-0 text-sm">
        <div className="flex items-baseline gap-4">
          <NavBrand />
          <span className="hidden font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground sm:inline">
            testnet
          </span>
        </div>
        <DashboardTabs path={path ?? "/dashboard"} />
        <div className="flex items-center justify-end gap-3">
          <AdminTogglePill />
          <SelboStatusPill />
          <HeaderAuth />
        </div>
      </div>
    );
  }
  // Marketing / legal / landing / public flagship. Owner controls
  // (admin toggle, status pill) belong on the dashboard, not here, so the
  // public nav is just brand + auth. The flagship (/selbo/*) is a full-bleed
  // terminal, so its nav spans the full width to align with the content.
  const fullBleed = path?.startsWith("/selbo/") ?? false;
  return (
    <div className={`mx-auto flex h-full items-center justify-between text-sm ${fullBleed ? "max-w-screen-2xl px-4" : "max-w-6xl px-6"}`}>
      <div className="flex items-baseline gap-4">
        <NavBrand />
        <span className="hidden font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground sm:inline">
          testnet
        </span>
      </div>
      <HeaderAuth />
    </div>
  );
}

export function FooterInner() {
  const path = usePathname();
  if (isDashboardRoute(path)) {
    return (
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 xl:px-0 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        <span>Selbo · paper mode · testnet</span>
        <a href="/legal/disclaimer" className="hover:text-[var(--neon-cyan)]">
          Disclaimer
        </a>
      </div>
    );
  }
  // Marketing / legal / landing / public flagship. Flagship spans full width
  // (edge-aligned) to match its terminal; others keep the centered column.
  const fullBleed = path?.startsWith("/selbo/") ?? false;
  return (
    <div className={`mx-auto flex flex-wrap items-center justify-between gap-3 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground ${fullBleed ? "max-w-screen-2xl px-4" : "max-w-6xl px-6"}`}>
      <span>Selbo · paper mode · testnet</span>
      <a href="/legal/disclaimer" className="hover:text-[var(--neon-cyan)]">
        Disclaimer
      </a>
    </div>
  );
}
