"use client";

import { ArcActivityCard } from "@/components/dashboard/arc-activity-card";

/**
 * Public read-only Arc activity feed for a flagship Selbo profile. Reuses
 * the dashboard ArcActivityCard with a username-scoped endpoint. Renders
 * nothing until the first response so a profile with no anchored events
 * stays clean.
 */
export function PublicArcActivity({ username }: { username: string }) {
  return (
    <ArcActivityCard endpoint={`/api/selbo/${encodeURIComponent(username)}/arc`} />
  );
}
