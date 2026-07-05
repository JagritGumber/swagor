import { Auth } from 'remix/middleware/auth'
import type { AppContext } from '../router.ts'
import { LandingPage } from '../pages/landing/page.tsx'

export async function home(context: AppContext) {
  const auth = context.get(Auth)
  const user = auth.ok ? { address: auth.identity.wallets[0].address } : undefined
  return context.render(<LandingPage user={user} />)
}
