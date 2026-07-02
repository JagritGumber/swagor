import { get, route } from 'remix/routes'

export const routes = route({
  assets: get('/assets/*path'),
  home: '/',
  portfolio: '/portfolio',
  agent: '/agent',
  candles: get('/api/candles'),
  subscribe: get('/api/candles/subscribe'),
})
