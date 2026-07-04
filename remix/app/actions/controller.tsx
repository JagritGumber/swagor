import { createController } from 'remix/router'
import { routes } from '../routes.ts'
import { assets } from './assets.ts'
import { home } from './home.tsx'
import { candles } from './candles.ts'
import { portfolio } from './portfolio.tsx'
import { agent } from './agent.tsx'
import { nonce } from './nonce.ts'
import { login } from './login.tsx'
import { logout } from './logout.ts'

export default createController(routes, {
  actions: { assets, home, candles, portfolio, agent, nonce, login, logout },
})
