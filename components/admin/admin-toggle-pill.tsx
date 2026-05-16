"use client";

import { useAdminUi } from "@/lib/utils/use-admin-ui";

/**
 * Navbar chip that lets admins flip admin-UI visibility. Green so the
 * user can spot which parts of the chrome are admin-only at a glance.
 * Renders null for non-admins so the surface stays clean for users.
 */
export function AdminTogglePill() {
  const { admin, ready, visible, toggle } = useAdminUi();
  if (!ready || !admin) return null;

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={visible}
      className={`inline-flex h-9 items-center gap-2 border px-3 font-mono text-xs font-bold uppercase tracking-[0.18em] focus:outline-none focus:ring-2 focus:ring-[var(--neon-green)] focus:ring-offset-2 focus:ring-offset-black ${
        visible
          ? "border-[var(--neon-green)] bg-[var(--neon-green)] text-black hover:bg-black hover:text-[var(--neon-green)]"
          : "border-[var(--neon-green)] bg-black text-[var(--neon-green)] hover:bg-[var(--neon-green)] hover:text-black"
      }`}
    >
      <span aria-hidden className="inline-block h-2 w-2 rounded-full bg-current" />
      Admin: {visible ? "on" : "off"}
    </button>
  );
}
