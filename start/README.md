# Selbo Start (TanStack Start + Bun)

TanStack Start app under `start/`, ported from `remix/` for full parity (routes, auth, APIs, SSE, judgment worker).

## Scripts

| Script | Purpose |
|--------|---------|
| `bun run dev` | Vite dev server on port `44100` (`bun --bun vite dev`) |
| `bun run build` | Production client + SSR bundles into `dist/` |
| `bun run start` | Custom Bun production server (`server.ts`) |
| `bun run typecheck` | `tsgo --noEmit` |
| `bun run db:generate` / `db:migrate` / `db:studio` | Drizzle |

## Environment

Copy `.env.example` to `.env` and set at least:

- `SELBO_SESSION_SECRET` - required for signed session cookies
- `CIRCLE_API_KEY` / `CIRCLE_ENTITY_SECRET` - wallet allocation
- `REDIS_URL` - BullMQ (default `redis://localhost:6379`)
- `PORT` - default `44100`
- `DRIZZLE_DRIVER` - `pglite` (default) or `postgres`

## Dev vs production worker

**Dev (`bun run dev`)** runs Vite only. It does **not** attach the BullMQ judgment worker. Page SSR, loaders, and most APIs work without Redis. Live judgment stream updates that depend on queue processing need Redis plus the production entry (or a separate worker process).

**Production** after build:

```bash
bun run build
bun run start
```

`server.ts`:

1. Polyfills `XMLHttpRequest` via `xhr2` for server-side alova
2. Loads the Start handler from `dist/server/server.js` (default export `{ fetch }`)
3. Serves static files from `dist/client` when present
4. Calls `startJudgmentWorker(REDIS_URL)` on boot
5. Calls `stopJudgmentWorker()` on `SIGINT` / `SIGTERM`

Redis is optional for HTTP listen: the process still binds the port if Redis is down. BullMQ connection errors log clearly (same as remix: worker starts unconditionally). For full SSE judgment updates, run Redis locally and set `REDIS_URL`.

## Build output layout

Verified for current `@tanstack/react-start` + Vite 8:

```
dist/
  client/          # browser assets + public files
  server/
    server.js      # production fetch handler
    assets/        # SSR chunks
```

No Nitro / `.output` path is used unless you add that plugin later.

## Notes

- Package manager: Bun only inside `start/`
- Session cookie: `selbo_session`
- Default port: `44100` (matches remix)
- Remix remains the behavioral reference under `../remix/`
