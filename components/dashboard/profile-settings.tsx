"use client";

import { useState } from "react";

/**
 * Username + public-profile editor. Drives the /selbo/{username} page.
 * Shows the current values up front so the user always knows what their
 * existing handle is before changing it. Username regex [a-z0-9_-]{2,32}
 * is enforced server-side.
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

  return (
    <section className="border border-[var(--hairline-strong)] bg-black p-6">
      <div className="grid grid-cols-2 gap-px border-y border-[var(--hairline-strong)] bg-[var(--hairline)]">
        <CurrentField label="Username" value={initialUsername ? `@${initialUsername}` : "not set"} />
        <CurrentField
          label="Visibility"
          value={initialPublic ? "public" : "private"}
          tone={initialPublic ? "cyan" : "muted"}
        />
      </div>

      <div className="mt-6 space-y-4">
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

        <label className="flex items-center gap-3">
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

function CurrentField({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "cyan" | "muted";
}) {
  const valueClass =
    tone === "cyan"
      ? "text-[var(--neon-cyan)]"
      : tone === "muted"
        ? "text-muted-foreground"
        : "text-foreground";
  return (
    <div className="bg-black px-4 py-3">
      <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </div>
      <div className={`mt-1 font-mono text-base ${valueClass}`}>{value}</div>
    </div>
  );
}
