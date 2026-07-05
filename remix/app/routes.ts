import { get, route } from 'remix/routes'

export const routes = route({
  assets: get('/assets/*path'),
  home: '/',
  dashboard: '/dashboard',
  dashboard2: '/dashboard-2',
  agent: '/agent',
  candles: get('/api/candles'),
  login: '/login',
  nonce: get('/api/nonce'),
  logout: '/logout',
})
