"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";

/**
 * Admin-only raw-JSON viewer for debugging. Collapsed by default so it
 * doesn't dominate the panel. Click the header to toggle.
 */
export function DebugJSON({
  title,
  value,
}: {
  title: string;
  value: unknown;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-3 border border-[var(--hairline)] bg-black">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground hover:text-[var(--neon-cyan)]"
      >
        <span>{title}</span>
        <ChevronRight
          aria-hidden
          className={`h-3 w-3 transition-transform ${open ? "rotate-90" : ""}`}
        />
      </button>
      {open && (
        <pre className="max-h-96 overflow-auto border-t border-[var(--hairline)] bg-[#040404] p-3 font-mono text-[11px] leading-relaxed text-foreground">
          {JSON.stringify(value, null, 2)}
        </pre>
      )}
    </div>
  );
}
