"use client";

import { useState } from "react";

/**
 * Username + public-profile editor. Drives the /selbo/{username} page.
 * Username is gated to [a-z0-9_-]{2,32} server-side; client validation is
 * a hint, the API is the truth. Toggling public exposes ticks, decisions,
 * positions, and the wallet -- the user is reminded of this in copy.
 */
export function ProfileSettings({
  initialUsername,
  initialPublic,
}: {
  initialUsername: string | null;
  initialPublic: boolean;
}) {
  const [username, setUsername] = useState(initialUsername ?? "");
  const [isPublic, setIsPublic] = useState(initialPublic);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  async function save() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username || undefined,
          publicProfile: isPublic,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(body.error ?? `HTTP ${res.status}`);
      } else {
        setSavedAt(Date.now());
      }
    } finally {
      setBusy(false);
    }
  }

  const url = username ? `/selbo/${username}` : null;

  return (
    <section className="border border-[var(--hairline-strong)] bg-black p-6">
      <h2 className="text-2xl font-bold uppercase leading-tight text-foreground">
        Public profile
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Pick a username and toggle public to publish Selbo at{" "}
        <span className="font-mono text-foreground">/selbo/&lt;username&gt;</span>. Visitors see your
        equity, watchlist, recent ticks, recent decisions. They cannot change anything.
      </p>

      <div className="mt-5 grid gap-4 sm:grid-cols-[1fr_auto]">
        <label className="block">
          <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            Username
          </span>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase())}
            placeholder="lowercase, 2-32 chars"
            className="mt-1 w-full border border-[var(--hairline-strong)] bg-black px-3 py-2 font-mono text-sm text-foreground focus:border-[var(--neon-cyan)] focus:outline-none"
          />
        </label>
        <label className="flex items-center gap-3 self-end">
          <input
            type="checkbox"
            checked={isPublic}
            onChange={(e) => setIsPublic(e.target.checked)}
            className="h-4 w-4 accent-[var(--neon-cyan)]"
          />
          <span className="font-mono text-xs font-bold uppercase tracking-[0.18em] text-foreground">
            Public
          </span>
        </label>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="inline-flex h-9 items-center justify-center border border-[var(--neon-cyan)] bg-[var(--neon-cyan)] px-5 font-mono text-xs font-bold uppercase tracking-[0.18em] text-black hover:bg-black hover:text-[var(--neon-cyan)] disabled:opacity-50"
        >
          {busy ? "Saving..." : "Save"}
        </button>
        {url && (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="font-mono text-xs uppercase tracking-[0.18em] text-[var(--neon-cyan)] underline-offset-4 hover:underline"
          >
            view public page
          </a>
        )}
        {savedAt && !error && (
          <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--neon-green)]">
            saved
          </span>
        )}
        {error && (
          <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--neon-red)]">
            {error}
          </span>
        )}
      </div>
    </section>
  );
}
