"use client";

import { useState } from "react";

/**
 * Kill switch UI. Flips solon_instances.kill_switch_active when wired.
 * Local-only state for now; API hookup lands with the /api/solon route.
 */
export function KillSwitchCard() {
  const [active, setActive] = useState(false);

  return (
    <section className="p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
            Kill switch
          </div>
          <div className="mt-3 text-xl font-bold uppercase leading-tight text-foreground">
            {active ? "Cycling paused" : "Cycling armed"}
          </div>
          <p className="mt-3 max-w-sm text-sm text-muted-foreground">
            {active
              ? "Your Solon will not scan or propose any new trades. Open positions remain untouched. Flip back when you are ready."
              : "Your Solon scans every fifteen minutes and runs the full panel when something shifts. Flip this if you want everything to stop."}
          </p>
        </div>
        <button
          type="button"
          aria-pressed={active}
          onClick={() => setActive((v) => !v)}
          className={`mt-1 inline-flex h-9 min-w-[120px] items-center justify-center border px-4 font-mono text-xs font-bold uppercase tracking-[0.18em] transition ${
            active
              ? "border-[var(--neon-red)] bg-[var(--neon-red)] text-black hover:bg-black hover:text-[var(--neon-red)]"
              : "border-[var(--hairline-strong)] bg-black text-foreground hover:border-[var(--neon-red)] hover:text-[var(--neon-red)]"
          }`}
        >
          {active ? "Resume" : "Pause"}
        </button>
      </div>
    </section>
  );
}
