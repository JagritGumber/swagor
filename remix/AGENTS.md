# Remix Agent Guide

This app was scaffolded with `remix new`. Use these conventions when continuing to build it out.

## Commands

```sh
npm i
npm run dev       # node --watch --import tsx/esm server.ts (port 44100)
npm run start     # production start
npm test
npm run typecheck # tsc --noEmit
```

The dev server uses `tsx/esm` (not `remix/node-tsx`). `tsx` handles extensionless imports so packages in `packages/` and `lib/` can be imported directly.

## Building Features

Refer to ./.agents/skills/remix/SKILL.md

## Starter Layout

- `app/actions/controller.tsx` owns the top-level route actions
- `app/routes.ts` defines the route contract
- `app/router.ts` wires routes to route handlers
- `app/middleware/render.tsx` installs the request-scoped renderer used by actions
- `app/ui/` holds the shared document shell and home page UI
- `app/assets.ts` owns the server-side asset pipeline used by the asset route and renderer
- `public/` contains static files served from the app root

## Route Ownership

- Start from `app/routes.ts` and map each route to the narrowest owner on disk.
- Put top-level route actions in `app/actions/controller.tsx`.
- Add `app/actions/<route-key>/controller.tsx` for nested route maps that need their own actions or middleware.
- Keep route-owned page modules next to the route that owns them.
- Move shared UI to `app/ui/`, not `app/actions/`.

## Build-Out Notes

- This starter intentionally begins small; add directories like `app/data/` and `test/` only when you need them.
- Prefer putting code in the narrowest owner before introducing shared modules.
- Avoid generic dumping-ground directories like `app/lib/` or `app/components/`.
- `app/data/` holds Remix-native data sources (e.g. `hyperliquid.ts`) that avoid Next.js-specific fetch options.
- Import strategy-lab functions individually from `../../../packages/strategy-lab/` to avoid barrel import chains that pull in optional deps.
- `/api/reader-read` is a Remix resource route mirroring the v2 reading engine (regime + auction) for client-side polling.

## Runtime Modules

- Uses `tsx/esm` instead of `remix/node-tsx` because strategy-lab and lib use extensionless imports that `remix/node-tsx`'s `oxc-transform` doesn't resolve.
- `packages/package.json` has `"type": "module"` so Node ESM loader treats packages as ES modules (no CJS-ESM cycle).

## Routes

- `home (/)` — portfolio dashboard (regime, auction, thesis cards)
- `readerRead (/api/reader-read)` — JSON resource route for client-side polling
- `assets (/assets/*path)` — Remix asset server
