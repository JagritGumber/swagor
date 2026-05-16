"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

type Props<T extends string> = {
  value: T;
  options: T[];
  onSelect: (v: T) => void;
  ariaLabel: string;
  label?: ReactNode;                 // override the trigger label (default = value)
  icon?: ReactNode;                  // optional leading icon
  iconOnly?: boolean;                // hide the text label entirely
  active?: boolean;                  // force-active styling (e.g. "extras" dropdown when an extra is selected)
  renderOption?: (opt: T) => ReactNode;
  align?: "left" | "right";
};

/**
 * Brutalist dropdown. Trigger button shows a value + chevron; click
 * reveals an options list. Click outside or Esc closes. Used by the
 * market chart controls for asset / window / extras / type. Generic
 * over a string union so callers keep type safety.
 */
export function Dropdown<T extends string>({
  value, options, onSelect, ariaLabel, label, icon, iconOnly = false,
  active = false, renderOption, align = "left",
}: Props<T>) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const triggerActive = active || open;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-haspopup="menu"
        className={`inline-flex h-7 items-center gap-1.5 border px-2.5 font-mono text-[11px] font-bold uppercase tracking-[0.16em] transition ${
          triggerActive
            ? "border-[var(--neon-cyan)] bg-[var(--neon-cyan)]/10 text-[var(--neon-cyan)]"
            : "border-[var(--hairline-strong)] bg-black text-foreground hover:border-[var(--neon-cyan)] hover:text-[var(--neon-cyan)]"
        }`}
      >
        {icon}
        {!iconOnly && (label ?? value)}
        <ChevronDown
          aria-hidden
          className={`h-3 w-3 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <ul
          role="menu"
          className={`absolute top-full z-30 mt-1 min-w-full border border-[var(--hairline-strong)] bg-black shadow-lg ${align === "right" ? "right-0" : "left-0"}`}
        >
          {options.map((opt) => (
            <li key={opt}>
              <button
                type="button"
                role="menuitem"
                onClick={() => { onSelect(opt); setOpen(false); }}
                className={`flex w-full items-center gap-2 whitespace-nowrap px-3 py-1.5 text-left font-mono text-[11px] font-bold uppercase tracking-[0.16em] transition ${
                  opt === value
                    ? "bg-[var(--neon-cyan)]/10 text-[var(--neon-cyan)]"
                    : "text-foreground hover:bg-[#0a0a0a] hover:text-[var(--neon-cyan)]"
                }`}
              >
                {renderOption ? renderOption(opt) : opt}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
