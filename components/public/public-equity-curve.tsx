"use client";

import { EquityCurve } from "@/components/dashboard/bento/equity-curve";

/**
 * Public read-only equity curve for a flagship Selbo profile. Forwards
 * the username-scoped endpoint to the dashboard EquityCurve so the chart
 * shell stays single-source-of-truth. Renders the same placeholder card
 * EquityCurve already shows when snapshots < 2.
 */
export function PublicEquityCurve({ username }: { username: string }) {
  return (
    <EquityCurve
      endpoint={`/api/public/selbo/${encodeURIComponent(username)}/equity`}
    />
  );
}
