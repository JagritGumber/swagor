"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

/**
 * Thin collapsible header above existing card content. Clicking the
 * header toggles its sibling content. No outer wrapper border, so the
 * wrapped card keeps its own styling -- avoids double-border ugliness.
 * Default closed so the dashboard's top viewport stays clear.
 */
export function DisclosureCard({
  title,
  subtitle,
  defaultOpen = false,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`space-y-3 ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 border border-[var(--hairline-strong)] bg-black px-5 py-2 text-left transition hover:bg-[#080808]"
      >
        <span className="flex items-baseline gap-3">
          <span aria-hidden className="inline-block h-2 w-2 bg-[var(--neon-cyan)]" />
          <span className="text-base font-bold uppercase tracking-tight text-foreground">
            {title}
          </span>
          {subtitle && (
            <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              {subtitle}
            </span>
          )}
        </span>
        <ChevronDown
          aria-hidden
          className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && children}
    </div>
  );
}
