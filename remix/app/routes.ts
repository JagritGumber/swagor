import { get, route } from 'remix/routes'

export const routes = route({
  assets: get('/assets/*path'),
  home: '/',
  dashboard: '/dashboard',
  agent: '/agent',
  candles: get('/api/candles'),
  login: '/login',
  nonce: get('/api/nonce'),
  balance: get('/api/balance'),
  logout: '/logout',
})
