"use client";

import { useState } from "react";

/**
 * Kill switch. Flips solon_instances.kill_switch_active when wired.
 * Local-only state for now; API hookup lands with /api/solon route.
 */
export function KillSwitchCard() {
  const [active, setActive] = useState(false);

  return (
    <section className="border border-[var(--hairline)] bg-black p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-2xl font-bold uppercase leading-tight text-foreground">
          Kill switch
        </h2>
        <button
          type="button"
          aria-pressed={active}
          onClick={() => setActive((v) => !v)}
          className={`inline-flex h-10 min-w-[120px] items-center justify-center border px-5 font-mono text-xs font-bold uppercase tracking-[0.18em] transition ${
            active
              ? "border-[var(--hairline-strong)] bg-black text-foreground hover:border-[var(--neon-cyan)] hover:text-[var(--neon-cyan)]"
              : "border-[var(--neon-red)] bg-[var(--neon-red)] text-black hover:bg-black hover:text-[var(--neon-red)]"
          }`}
        >
          {active ? "Resume" : "Kill"}
        </button>
      </div>
    </section>
  );
}
