"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { authClient } from "@/lib/auth-client";

/**
 * Pathname-aware nav primary button.
 *   - Not logged in: cyan-filled "Sign In" -> /sign-in
 *   - Logged in, public page: cyan-filled "Dashboard" -> /dashboard
 *   - Logged in, already on /dashboard*: hairline "Sign Out" (calls authClient.signOut())
 */
const PRIMARY =
  "cta-glow inline-flex h-9 items-center justify-center border border-[var(--neon-cyan)] bg-[var(--neon-cyan)] px-4 font-mono text-xs font-bold uppercase tracking-[0.18em] text-black hover:bg-black hover:text-[var(--neon-cyan)] focus:outline-none focus:ring-2 focus:ring-[var(--neon-cyan)] focus:ring-offset-2 focus:ring-offset-black";

const OUTLINE =
  "inline-flex h-9 items-center justify-center border border-[var(--hairline-strong)] bg-black px-4 font-mono text-xs font-bold uppercase tracking-[0.18em] text-foreground transition hover:border-[var(--neon-red)] hover:text-[var(--neon-red)] focus:outline-none focus:ring-2 focus:ring-[var(--neon-red)] focus:ring-offset-2 focus:ring-offset-black";

export function AuthNavLink() {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session, isPending } = authClient.useSession();
  const onDashboard = pathname?.startsWith("/dashboard") ?? false;

  if (isPending) return <div className="h-9 w-[88px]" aria-hidden />;

  if (!session) {
    return (
      <Link href="/sign-in" className={PRIMARY}>
        Sign In
      </Link>
    );
  }

  if (onDashboard) {
    return (
      <button
        type="button"
        className={OUTLINE}
        onClick={async () => {
          await authClient.signOut();
          router.push("/sign-in");
          router.refresh();
        }}
      >
        Sign Out
      </button>
    );
  }

  return (
    <Link href="/dashboard" className={PRIMARY}>
      Dashboard
    </Link>
  );
}
