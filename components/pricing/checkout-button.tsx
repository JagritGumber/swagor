"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

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
      const res = await fetch("/api/polar/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      if (body.url) window.location.href = body.url;
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
