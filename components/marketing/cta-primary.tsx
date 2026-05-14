"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { authClient } from "@/lib/auth-client";

/**
 * Auth-aware primary CTA used on the landing hero + CTA footer. The button
 * label and destination flip based on session state:
 *   - Logged out: "Deploy your Selbo" -> /sign-up
 *   - Logged in:  "Open dashboard"    -> /dashboard
 *
 * During the brief session-hydration window, the button renders disabled
 * with its widest label so layout doesn't shift when the real state lands.
 */
export function CtaPrimary({ className }: { className?: string }) {
  const { data: session, isPending } = authClient.useSession();

  if (isPending) {
    return (
      <span
        aria-hidden
        className={`${className ?? ""} pointer-events-none invisible`}
      >
        <span>Deploy your Selbo</span>
        <ArrowRight className="h-4 w-4" aria-hidden />
      </span>
    );
  }

  const href = session ? "/dashboard" : "/sign-up";
  const label = session ? "Open dashboard" : "Deploy your Selbo";

  return (
    <Link href={href} className={className}>
      <span>{label}</span>
      <ArrowRight
        aria-hidden
        className="h-4 w-4 transition-transform group-hover:translate-x-1"
      />
    </Link>
  );
}
