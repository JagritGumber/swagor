// Generated at build time by `opennextjs-cloudflare build`. Not committed.
// @ts-expect-error - .open-next/worker.js exists only after the build runs.
import { default as handler } from "./.open-next/worker.js";

/**
 * Custom Worker entry. Wraps the OpenNext-generated fetch handler so we can
 * attach a Cron Triggers `scheduled()` handler alongside it. The cron fires
 * every 60 seconds (per wrangler.jsonc) and hits the watcher endpoint with a
 * shared secret. Internal fetch — no edge round-trip, no public URL needed.
 */
export default {
  fetch: handler.fetch,

  async scheduled(
    _controller: ScheduledController,
    env: { CRON_SECRET?: string },
    ctx: ExecutionContext,
  ) {
    ctx.waitUntil(
      handler.fetch(
        new Request("https://internal/api/watcher/tick", {
          method: "POST",
          headers: env.CRON_SECRET
            ? { Authorization: `Bearer ${env.CRON_SECRET}` }
            : {},
        }),
        env,
        ctx,
      ),
    );
  },
};
