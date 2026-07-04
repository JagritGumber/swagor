import type { AppContext } from '../router.ts'
import { LandingPage } from '../pages/landing/page.tsx'

export async function home(context: AppContext) {
  return context.render(<LandingPage />)
}
