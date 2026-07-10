import { get, route } from 'remix/routes'

export const routes = route({
  assets: get('/assets/*path'),
  home: '/',
  agent: '/agent',
  dashboard: '/dashboard',
  candles: get('/api/candles'),
  judgmentTick: get('/admin/judgment/tick'),
  judgmentHistory: get('/api/judgment/history'),
  judgmentStream: get('/api/judgment/stream'),
  login: '/login',
  nonce: get('/api/nonce'),
  balance: get('/api/balance'),
  logout: '/logout',
})
