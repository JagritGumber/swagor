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

- `app/pages/` — one file per route, thin composition only (e.g. `portfolio.tsx` → `/portfolio`)
- `app/components/` — UI components, with subdirs per domain (e.g. `portfolio/`) or type (e.g. `widgets/`)
- `app/components/widget-holder.tsx` — generic widget grid that accepts `{ key, render }[]` for swappable widgets
- `app/types/` — shared type definitions
- `app/constants/` — shared constants and style objects
- `app/actions/controller.tsx` — top-level route actions
- `app/routes.ts` — route contract
- `app/router.ts` — wires routes to handlers
- `app/middleware/render.tsx` — request-scoped renderer
- `app/document.tsx` — shared HTML document shell
- `app/data/` — Remix-native data sources (e.g. `hyperliquid.ts`)
- `app/assets.ts` — server-side asset pipeline
- `public/` — static files served from app root

## Route Ownership

- Start from `app/routes.ts` and map each route to a page in `app/pages/`.
- Put top-level route actions in `app/actions/controller.tsx`.
- Page modules in `app/pages/` should be thin — import the real component from `app/components/`.
- Shared shell goes in `app/document.tsx`, not in pages.
- Import strategy-lab functions individually from `../../../packages/strategy-lab/` to avoid barrel import chains that pull in optional deps.
- `/api/reader-read` is a Remix resource route mirroring the v2 reading engine (regime + auction) for client-side polling.

## Runtime Modules

- Uses `tsx/esm` instead of `remix/node-tsx` because strategy-lab and lib use extensionless imports that `remix/node-tsx`'s `oxc-transform` doesn't resolve.
- `packages/package.json` has `"type": "module"` so Node ESM loader treats packages as ES modules (no CJS-ESM cycle).

## Routes

- `home (/)` — redirects to `/portfolio`
- `portfolio (/portfolio)` — portfolio dashboard (regime, auction, position widgets)
- `readerRead (/api/reader-read)` — JSON resource route for client-side polling
- `assets (/assets/*path)` — Remix asset server
