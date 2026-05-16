"use client";

import type { ReactNode } from "react";
import { useAdminUi } from "@/lib/utils/use-admin-ui";

/**
 * Renders its children only when the caller is admin AND has the admin
 * UI toggle set to visible. Server pages still gate `admin` at render
 * time; this client gate exists so admins can hide their own admin
 * panels via the navbar pill without losing access to bring them back.
 */
export function AdminGate({ children }: { children: ReactNode }) {
  const { admin, ready, visible } = useAdminUi();
  if (!ready || !admin || !visible) return null;
  return <>{children}</>;
}
