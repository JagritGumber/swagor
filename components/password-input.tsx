"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

/**
 * Brutalist password input with show/hide toggle. Drop-in for a styled
 * <input type="password" />: takes all standard input props plus the
 * existing className for the field. The eye toggle button sits inside the
 * field at the right edge.
 */
export function PasswordInput({
  className = "",
  ...props
}: Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">) {
  const [show, setShow] = useState(false);

  return (
    <div className="relative">
      <input
        {...props}
        type={show ? "text" : "password"}
        className={`${className} pr-11`}
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? "Hide password" : "Show password"}
        aria-pressed={show}
        tabIndex={-1}
        className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground transition hover:text-[var(--neon-cyan)] focus:outline-none focus-visible:text-[var(--neon-cyan)]"
      >
        {show ? <EyeOff aria-hidden className="h-4 w-4" /> : <Eye aria-hidden className="h-4 w-4" />}
      </button>
    </div>
  );
}
