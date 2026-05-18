"use client";

import { useState } from "react";
import { toast } from "sonner";

type Template = "waitlist-confirmation" | "beta-invite";

/**
 * Two admin buttons that POST to /api/admin/emails/test, sending a test
 * render of each email template to the admin's own inbox. Use to iterate
 * on Brevo + Maizzle output without going through the full signup or
 * invite flow.
 */
export function EmailTestButtons() {
  const [busy, setBusy] = useState<Template | null>(null);

  async function send(template: Template) {
    if (busy) return;
    setBusy(template);
    try {
      const res = await fetch("/api/admin/emails/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template }),
      });
      const body = await res.json() as { ok?: boolean; to?: string; error?: string };
      if (!res.ok || !body.ok) {
        toast.error(body.error ?? `HTTP ${res.status}`);
      } else {
        toast.success(`Sent ${template} to ${body.to}`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-[var(--neon-green)]/40 px-6 py-3">
      <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
        email preview
      </span>
      <button
        type="button" onClick={() => send("waitlist-confirmation")} disabled={busy !== null}
        className="border border-[var(--neon-green)] bg-black px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--neon-green)] hover:bg-[var(--neon-green)] hover:text-black disabled:opacity-60"
      >
        {busy === "waitlist-confirmation" ? "sending..." : "send waitlist email to me"}
      </button>
      <button
        type="button" onClick={() => send("beta-invite")} disabled={busy !== null}
        className="border border-[var(--neon-green)] bg-black px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--neon-green)] hover:bg-[var(--neon-green)] hover:text-black disabled:opacity-60"
      >
        {busy === "beta-invite" ? "sending..." : "send beta invite to me"}
      </button>
    </div>
  );
}
