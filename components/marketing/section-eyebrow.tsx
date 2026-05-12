/**
 * Section eyebrow primitive. Small solid square tip + mono caps label.
 * Replaces the `// eyebrow` slash pattern. Single source so every section
 * eyebrow stays identical across the landing.
 */

import type { ReactNode } from "react";

export function SectionEyebrow({ children }: { children: ReactNode }) {
  return (
    <div className="inline-flex items-center gap-2.5 font-mono text-sm font-semibold uppercase tracking-[0.18em] text-[var(--neon-cyan)]">
      <span aria-hidden className="inline-block h-2.5 w-2.5 bg-[var(--neon-cyan)]" />
      <span>{children}</span>
    </div>
  );
}
