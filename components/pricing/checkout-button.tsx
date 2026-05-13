"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";

/**
 * Subscription checkout button. Calls Better Auth's Polar plugin, which
 * issues a Polar Checkout URL keyed by the product slug we registered in
 * lib/auth.ts (`basic` or `pro`). Redirects there. Polar handles payment +
 * webhooks back to /api/auth/polar/webhooks; tier flips in the DB
 * automatically.
 */
export function CheckoutButton({
  tier, signedIn,
}: {
  tier: "basic" | "pro";
  signedIn: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function go() {
    if (!signedIn) {
      router.push(`/sign-up?next=/pricing`);
      return;
    }
    setLoading(true); setErr(null);
    try {
      // The Polar plugin's checkout call redirects via authClient hooks;
      // it either navigates or returns a URL.
      const result = await authClient.checkout({ slug: tier });
      if (result?.error) throw new Error(result.error.message ?? "Checkout failed");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Checkout failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={go}
        disabled={loading}
        className="cta-glow inline-flex h-10 w-full items-center justify-center border border-[var(--neon-cyan)] bg-[var(--neon-cyan)] px-4 font-mono text-xs font-bold uppercase tracking-[0.18em] text-black hover:bg-black hover:text-[var(--neon-cyan)] disabled:opacity-50"
      >
        {loading ? "Loading..." : signedIn ? "Subscribe" : "Sign up to subscribe"}
      </button>
      {err && <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--neon-red)]">{err}</p>}
    </div>
  );
}
