/**
 * Site / auth URL resolution with a localhost fallback.
 *
 * Default behavior across all callsites:
 *  - `NODE_ENV !== "production"` (dev / preview / undefined): return localhost
 *  - production with env var SET: return the env var (trimmed)
 *  - production with env var MISSING: return localhost (better than crashing)
 *
 * This deliberately overrides the project's general "throw on missing env"
 * rule for these three URL vars specifically. Rationale: a missing
 * NEXT_PUBLIC_SITE_URL during a local `next build` shouldn't take the dev
 * loop down, and a missing prod URL is a config bug we recover from rather
 * than crash on.
 */

const LOCALHOST = "http://localhost:3000";

function isDev(): boolean {
  return process.env.NODE_ENV !== "production";
}

export function siteUrl(): string {
  if (isDev()) return LOCALHOST;
  return process.env.NEXT_PUBLIC_SITE_URL?.trim() || LOCALHOST;
}

export function betterAuthUrlPublic(): string {
  if (isDev()) return LOCALHOST;
  return process.env.NEXT_PUBLIC_BETTER_AUTH_URL?.trim() || LOCALHOST;
}

export function betterAuthUrlServer(): string {
  if (isDev()) return LOCALHOST;
  return process.env.BETTER_AUTH_URL?.trim() || LOCALHOST;
}
