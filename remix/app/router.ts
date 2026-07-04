import { createRouter, type MiddlewareContext } from 'remix/router'
import { staticFiles } from 'remix/middleware/static'

import controller from './actions/controller.tsx'
import { render } from './middleware/render.tsx'
import { sessionMiddleware, authMiddleware } from './middleware/auth.ts'
import { routes } from './routes.ts'

type AppContext = MiddlewareContext<[ReturnType<typeof staticFiles>, typeof sessionMiddleware, typeof authMiddleware, ReturnType<typeof render>]>

declare module 'remix/router' {
  interface RouterTypes {
    context: AppContext
  }
}

export type { AppContext }

export const router = createRouter<AppContext>({
  middleware: [staticFiles('./public', { index: false }), sessionMiddleware, authMiddleware, render()],
})

router.map(routes, controller)
