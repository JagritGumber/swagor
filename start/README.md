# Selbo Start (TanStack Start + Bun)

TanStack Start app under `start/`. Port of the Remix v3 app for full route/API/auth/SSE parity.

**Separate codebases (do not mix):**

| Path | Role |
|------|------|
| `start/` | **This app** - TanStack Start + Bun (port `44100`) |
| `remix/` | Remix v3 behavioral reference - leave intact |
| Root Next.js (`app/`, root `package.json`) | Unrelated product surface - do not modify for this port |

## Quick start

```bash
cd start
bun install
copy .env.example .env   # Windows; on Unix: cp .env.example .env
# Edit .env - set SELBO_SESSION_SECRET at minimum (openssl rand -hex 32 or bun -e "...")
bun --bun run dev
```

Open [http://localhost:44100](http://localhost:44100).

## Scripts

| Command | Purpose |
|---------|---------|
| `bun install` | Install dependencies (Bun only inside `start/`) |
| `bun --bun run dev` | Vite dev server on port `44100` |
| `bun run build` | Production client + SSR bundles into `dist/` |
| `bun run start` | Custom Bun production server (`server.ts`) |
| `bun run typecheck` | `tsgo --noEmit` |
| `bun run db:generate` / `db:migrate` / `db:studio` | Drizzle |

Equivalent npm-style scripts live in `package.json` as `dev`, `build`, `start`. Prefer `bun --bun run dev` so Vite runs under Bun.

## Environment

Copy `.env.example` to `.env` and configure:

| Variable | Required | Notes |
|----------|----------|-------|
| `SELBO_SESSION_SECRET` | Yes for auth | Signs `selbo_session` cookies |
| `CIRCLE_API_KEY` / `CIRCLE_ENTITY_SECRET` | For wallet login path | Circle developer wallets |
| `REDIS_URL` | For judgment worker | Default `redis://localhost:6379` |
| `PORT` | No | Default `44100` |
| `DRIZZLE_DRIVER` | No | `pglite` (default) or `postgres` |
| `DATABASE_URL` | If postgres | Connection string or PGlite data path |

## Redis (judgment worker)

**BullMQ judgment worker needs Redis** for queue processing and live judgment ticks that drive SSE updates.

- **Dev (`bun --bun run dev`)**: Vite only. No BullMQ worker is attached. Public pages, loaders, and most APIs work without Redis. SSE endpoints exist, but queue-driven judgment updates will not fire without a worker process.
- **Production**: after build, `bun run start` boots `server.ts`, which calls `startJudgmentWorker(REDIS_URL)` and stops the worker on `SIGINT` / `SIGTERM`.

```bash
# Full stack with worker (Redis running locally)
bun run build
bun run start
```

Redis is optional for HTTP listen: the process still binds the port if Redis is down. Connection errors log via BullMQ. For full SSE judgment updates when the worker fires, run Redis and set `REDIS_URL`.

## Build / production

```bash
bun run build
bun run start
```

`server.ts`:

1. Polyfills `XMLHttpRequest` via `xhr2` for server-side alova
2. Loads the Start handler from `dist/server/server.js` (default export `{ fetch }`)
3. Serves static files from `dist/client` when present
4. Starts judgment worker; stops on signal

Build layout (current `@tanstack/react-start` + Vite 8):

```
dist/
  client/          # browser assets + public files
  server/
    server.js      # production fetch handler
    assets/        # SSR chunks
```

## Notes

- Package manager: Bun only inside `start/`
- Session cookie: `selbo_session` (payload `{ userId: string }`)
- Default port: `44100` (matches remix)
- Do not delete or repoint `remix/` or the root Next.js app for this work
- Stop dev Vite before `bun run start` (both default to `44100`)
