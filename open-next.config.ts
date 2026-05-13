import { defineCloudflareConfig } from "@opennextjs/cloudflare";

/**
 * OpenNext config for Cloudflare Workers deploy.
 *
 * No incremental cache override — we don't use ISR / `revalidate`. If we ever
 * add per-page revalidation, wire up R2 here:
 *
 *   import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";
 *   incrementalCache: r2IncrementalCache,
 *
 * and bind an R2 bucket named NEXT_INC_CACHE_R2_BUCKET in wrangler.jsonc.
 */
export default defineCloudflareConfig({});
