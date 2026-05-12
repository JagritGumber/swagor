"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOutAction } from "@/app/actions";

/**
 * Pathname-aware nav primary button.
 * Logged out: cyan-filled "Sign In" -> /sign-in
 * Logged in, public page: cyan-filled "Dashboard" -> /dashboard
 * Logged in, already on /dashboard*: hairline "Sign Out" (form action)
 */
const PRIMARY =
  "cta-glow inline-flex h-9 items-center justify-center border border-[var(--neon-cyan)] bg-[var(--neon-cyan)] px-4 font-mono text-xs font-bold uppercase tracking-[0.18em] text-black hover:bg-black hover:text-[var(--neon-cyan)] focus:outline-none focus:ring-2 focus:ring-[var(--neon-cyan)] focus:ring-offset-2 focus:ring-offset-black";

const OUTLINE =
  "inline-flex h-9 items-center justify-center border border-[var(--hairline-strong)] bg-black px-4 font-mono text-xs font-bold uppercase tracking-[0.18em] text-foreground transition hover:border-[var(--neon-red)] hover:text-[var(--neon-red)] focus:outline-none focus:ring-2 focus:ring-[var(--neon-red)] focus:ring-offset-2 focus:ring-offset-black";

export function AuthNavLink({ loggedIn }: { loggedIn: boolean }) {
  const pathname = usePathname();
  const onDashboard = pathname?.startsWith("/dashboard") ?? false;

  if (!loggedIn) {
    return (
      <Link href="/sign-in" className={PRIMARY}>
        Sign In
      </Link>
    );
  }

  if (onDashboard) {
    return (
      <form action={signOutAction}>
        <button type="submit" className={OUTLINE}>
          Sign Out
        </button>
      </form>
    );
  }

  return (
    <Link href="/dashboard" className={PRIMARY}>
      Dashboard
    </Link>
  );
}
