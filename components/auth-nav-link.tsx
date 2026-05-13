"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, LayoutDashboard, User, LogOut } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

const PRIMARY =
  "cta-glow inline-flex h-9 items-center justify-center border border-[var(--neon-cyan)] bg-[var(--neon-cyan)] px-4 font-mono text-xs font-bold uppercase tracking-[0.18em] text-black hover:bg-black hover:text-[var(--neon-cyan)] focus:outline-none focus:ring-2 focus:ring-[var(--neon-cyan)] focus:ring-offset-2 focus:ring-offset-black";

const TRIGGER =
  "inline-flex h-9 items-center gap-2 border border-[var(--hairline-strong)] bg-black px-3 font-mono text-xs font-bold uppercase tracking-[0.18em] text-foreground hover:border-[var(--neon-cyan)] hover:text-[var(--neon-cyan)] focus:outline-none focus:ring-2 focus:ring-[var(--neon-cyan)] focus:ring-offset-2 focus:ring-offset-black";

/**
 * Pathname-aware nav button.
 *   - Not logged in: cyan-filled "Sign In" -> /sign-in
 *   - Logged in: profile dropdown with Dashboard, Profile, Sign Out. Trigger
 *     shows the user's email initials so the nav stays brutalist mono.
 */
export function AuthNavLink() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();

  if (isPending) return <div className="h-9 w-[88px]" aria-hidden />;

  if (!session) {
    return (
      <Link href="/sign-in" className={PRIMARY}>
        Sign In
      </Link>
    );
  }

  const initials = (session.user.email ?? "??").slice(0, 2).toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={TRIGGER} aria-label="Account menu">
        <span>{initials}</span>
        <ChevronDown aria-hidden className="h-3.5 w-3.5 opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="min-w-[200px] rounded-none border-[var(--hairline-strong)] bg-black p-1"
      >
        <DropdownMenuItem
          asChild
          className="cursor-pointer rounded-none px-3 py-2.5 font-mono text-xs uppercase tracking-[0.16em] focus:bg-[#080808] focus:text-[var(--neon-cyan)]"
        >
          <Link href="/dashboard">
            <LayoutDashboard aria-hidden className="mr-2 h-3.5 w-3.5" />
            Dashboard
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          asChild
          className="cursor-pointer rounded-none px-3 py-2.5 font-mono text-xs uppercase tracking-[0.16em] focus:bg-[#080808] focus:text-[var(--neon-cyan)]"
        >
          <Link href="/dashboard/profile">
            <User aria-hidden className="mr-2 h-3.5 w-3.5" />
            Profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator className="bg-[var(--hairline-strong)]" />
        <DropdownMenuItem
          onClick={async () => {
            await authClient.signOut();
            router.push("/sign-in");
            router.refresh();
          }}
          className="cursor-pointer rounded-none px-3 py-2.5 font-mono text-xs uppercase tracking-[0.16em] text-[var(--neon-red)] focus:bg-[#080808] focus:text-[var(--neon-red)]"
        >
          <LogOut aria-hidden className="mr-2 h-3.5 w-3.5" />
          Sign Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
