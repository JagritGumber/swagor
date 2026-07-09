import { createController } from 'remix/router'
import { routes } from '../routes.ts'
import { assets } from './assets.ts'
import { home } from './home.tsx'
import { agent } from './agent.tsx'
import { dashboard } from './dashboard.tsx'
import { candles } from './candles.ts'
import { judgmentTick } from './judgment-tick.ts'
import { judgmentHistory } from './judgment-history.ts'
import { nonce } from './nonce.ts'
import { balance } from './balance.ts'
import { login } from './login.tsx'
import { logout } from './logout.ts'

export default createController(routes, {
  actions: {
    assets, home, agent, dashboard, candles,
    judgmentTick, judgmentHistory,
    nonce, balance, login, logout,
  },
})
