import { get, route } from 'remix/routes'

export const routes = route({
  assets: get('/assets/*path'),
  home: '/',
  portfolio: '/portfolio',
  candles: get('/api/candles'),
  readerRead: get('/api/reader-read'),
  regimeSegments: get('/api/regime-segments'),
})
