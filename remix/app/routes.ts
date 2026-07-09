import { get, route } from 'remix/routes'

export const routes = route({
  assets: get('/assets/*path'),
  home: '/',
  agent: '/agent',
  dashboard: '/dashboard',
  candles: get('/api/candles'),
  judgmentTick: get('/api/judgment/tick'),
  judgmentHistory: get('/api/judgment/history'),
  login: '/login',
  nonce: get('/api/nonce'),
  balance: get('/api/balance'),
  logout: '/logout',
})
