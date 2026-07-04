import { redirect } from 'remix/response/redirect'
import { Session } from 'remix/session'
import type { AppContext } from '../router.ts'

export async function logout(context: AppContext) {
  const session = context.get(Session)
  session.unset('auth')
  session.regenerateId(true)
  return redirect('/login')
}
