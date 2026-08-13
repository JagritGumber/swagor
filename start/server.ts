/**
 * TanStack Start production server (Bun) + judgment worker lifecycle.
 *
 * Build output (vite + @tanstack/react-start):
 *   dist/server/server.js  - default export { fetch }
 *   dist/client/           - static assets (hashed under /assets)
 *
 * Dev stays on Vite (`bun run dev`). Full BullMQ worker + production SSR:
 *   bun run build && bun run start
 */

import XHR2 from 'xhr2'
if (typeof globalThis.XMLHttpRequest === 'undefined') {
  globalThis.XMLHttpRequest = XHR2 as typeof globalThis.XMLHttpRequest
}

import path from 'node:path'
import {
  startJudgmentWorker,
  stopJudgmentWorker,
} from './src/services/judgment/queue-worker.ts'

const port = process.env.PORT ? Number.parseInt(process.env.PORT, 10) : 44100
const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379'
const CLIENT_DIRECTORY = './dist/client'
const SERVER_ENTRY_POINT = './dist/server/server.js'

type StartHandler = {
  fetch: (request: Request) => Response | Promise<Response>
}

async function loadStartHandler(): Promise<StartHandler> {
  const serverModule = (await import(SERVER_ENTRY_POINT)) as {
    default: StartHandler
  }
  const handler = serverModule.default
  if (!handler || typeof handler.fetch !== 'function') {
    throw new Error(
      `TanStack Start handler missing default.fetch at ${SERVER_ENTRY_POINT}. Run bun run build first.`,
    )
  }
  return handler
}

async function tryServeStatic(pathname: string): Promise<Response | null> {
  // Never map directory roots or empty paths to disk; let SSR handle app routes.
  if (pathname === '/' || pathname.endsWith('/')) {
    return null
  }

  const relative = pathname.replace(/^\/+/, '')
  const filepath = path.join(CLIENT_DIRECTORY, relative)
  const resolvedClient = path.resolve(CLIENT_DIRECTORY)
  const resolvedFile = path.resolve(filepath)
  if (
    resolvedFile !== resolvedClient &&
    !resolvedFile.startsWith(resolvedClient + path.sep)
  ) {
    return null
  }

  const file = Bun.file(filepath)
  if (!(await file.exists()) || file.size === 0) {
    return null
  }

  const immutable = relative.startsWith('assets/')
  return new Response(file, {
    headers: {
      'Content-Type': file.type || 'application/octet-stream',
      'Cache-Control': immutable
        ? 'public, max-age=31536000, immutable'
        : 'public, max-age=3600',
    },
  })
}

async function main() {
  const handler = await loadStartHandler()

  // Match remix: start worker unconditionally. Redis connect errors surface via BullMQ.
  startJudgmentWorker(redisUrl)

  const server = Bun.serve({
    port,
    async fetch(req) {
      const url = new URL(req.url)
      try {
        const staticResponse = await tryServeStatic(url.pathname)
        if (staticResponse) {
          return staticResponse
        }
        return await handler.fetch(req)
      } catch (error) {
        if (!(req.signal.aborted && error === req.signal.reason)) {
          console.error(error)
        }
        return new Response('Internal Server Error', { status: 500 })
      }
    },
    error(error) {
      console.error(
        `Uncaught server error: ${error instanceof Error ? error.message : String(error)}`,
      )
      return new Response('Internal Server Error', { status: 500 })
    },
  })

  console.log(`Server listening on http://localhost:${String(server.port)}`)

  let shuttingDown = false
  async function shutdown() {
    if (shuttingDown) {
      return
    }
    shuttingDown = true
    console.log('Shutting down...')
    try {
      await stopJudgmentWorker()
    } catch (error) {
      console.error('Failed to stop judgment worker:', error)
    }
    server.stop(true)
    process.exit(0)
  }

  process.on('SIGINT', () => {
    void shutdown()
  })
  process.on('SIGTERM', () => {
    void shutdown()
  })
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
