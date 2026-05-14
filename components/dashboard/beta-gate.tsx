"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Private-beta code redemption form. Shown on the dashboard when the
 * user's solon_instances row has betaAccessGranted=false. While this is
 * rendered, all other dashboard sections (watcher feed, market chart,
 * trades, etc) are hidden to keep the UI honest about what is actually
 * doing work for the user.
 */
export function BetaGate() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function redeem(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/beta/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || body.ok === false) {
        setError(body.error ?? `HTTP ${res.status}`);
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="border border-[var(--neon-cyan)] bg-black p-8">
      <div className="font-mono text-xs uppercase tracking-[0.2em] text-[var(--neon-cyan)]">
        Private beta
      </div>
      <h1 className="mt-3 text-3xl font-bold uppercase leading-tight text-foreground">
        Enter your beta code
      </h1>
      <p className="mt-4 max-w-xl text-base leading-relaxed text-muted-foreground">
        Selbo is in invite-only beta. Until you redeem a code, your account exists
        but Selbo isn&apos;t scanning markets or burning tokens. Drop the code below
        and your watcher starts cycling.
      </p>

      <form onSubmit={redeem} className="mt-6 flex flex-wrap items-center gap-3">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="beta code"
          autoComplete="off"
          spellCheck={false}
          className="h-11 min-w-[220px] flex-1 border border-[var(--hairline-strong)] bg-black px-3 font-mono text-sm uppercase tracking-[0.18em] text-foreground focus:border-[var(--neon-cyan)] focus:outline-none"
        />
        <button
          type="submit"
          disabled={busy || !code.trim()}
          className="inline-flex h-11 items-center justify-center border border-[var(--neon-cyan)] bg-[var(--neon-cyan)] px-6 font-mono text-xs font-bold uppercase tracking-[0.18em] text-black hover:bg-black hover:text-[var(--neon-cyan)] disabled:opacity-50"
        >
          {busy ? "Redeeming..." : "Redeem"}
        </button>
      </form>

      {error && (
        <p className="mt-4 font-mono text-xs uppercase tracking-[0.18em] text-[var(--neon-red)]">
          {error}
        </p>
      )}

      <p className="mt-6 max-w-xl text-sm leading-relaxed text-muted-foreground">
        Got a beta code from us? Drop it above. If you don&apos;t have one and want
        in, ask the team.
      </p>
    </section>
  );
}
