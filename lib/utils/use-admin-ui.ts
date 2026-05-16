"use client";

import { useCallback, useEffect, useState } from "react";

const VISIBLE_KEY = "selbo:admin-ui-visible";

/**
 * Client-side admin-UI state. Fetches /api/admin/me once on mount to
 * know if the caller is admin; keeps a localStorage flag the admin can
 * flip from the navbar toggle pill to hide admin sections without
 * losing the ability to bring them back. Default visibility = true.
 *
 * Returns `{ admin, ready, visible, toggle }`:
 *  - admin: true when the server confirmed the email is in ADMIN_EMAILS
 *  - ready: server check finished (don't render gated UI until ready)
 *  - visible: the localStorage flag (only meaningful when admin)
 *  - toggle: flips the flag + emits a storage event so other tabs sync
 */
export function useAdminUi(): {
  admin: boolean;
  ready: boolean;
  visible: boolean;
  toggle: () => void;
} {
  const [admin, setAdmin] = useState(false);
  const [ready, setReady] = useState(false);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/me", { cache: "no-store" })
      .then((r) => r.ok ? r.json() as Promise<{ admin: boolean }> : { admin: false })
      .then((body) => {
        if (cancelled) return;
        setAdmin(body.admin);
        setReady(true);
      })
      .catch(() => { if (!cancelled) setReady(true); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const stored = window.localStorage.getItem(VISIBLE_KEY);
    if (stored !== null) setVisible(stored === "1");
    const onStorage = (e: StorageEvent) => {
      if (e.key === VISIBLE_KEY && e.newValue !== null) setVisible(e.newValue === "1");
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const toggle = useCallback(() => {
    setVisible((v) => {
      const next = !v;
      window.localStorage.setItem(VISIBLE_KEY, next ? "1" : "0");
      return next;
    });
  }, []);

  return { admin, ready, visible, toggle };
}
