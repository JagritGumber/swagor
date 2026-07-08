import { createAlova } from 'alova'
import { xhrRequestAdapter } from '@alova/adapter-xhr'
import { createRateLimiter } from 'alova/server'

const HL_TIMEOUT = 10_000

const memoryStore = new Map<string, unknown>()
const l2Cache = {
  get: (key: string): any => memoryStore.get(key) ?? null,
  set: (key: string, value: unknown) => { memoryStore.set(key, value) },
  remove: (key: string) => { memoryStore.delete(key) },
  clear: () => { memoryStore.clear() },
}

function createHlAlova(baseURL: string) {
  return createAlova({
    baseURL,
    requestAdapter: xhrRequestAdapter(),
    timeout: HL_TIMEOUT,
    l2Cache,
    responded: (response) => {
      if (response.status < 200 || response.status >= 300) {
        throw new Error(`HL ${response.status}: ${response.data}`)
      }
      return response.data
    },
  })
}

export const hlAlovaTestnet = createHlAlova('https://api.hyperliquid-testnet.xyz/info')
export const hlAlovaMainnet = createHlAlova('https://api.hyperliquid.xyz/info')

export const hlRateLimiter = createRateLimiter({
  duration: 60_000,
  points: 20,
  keyPrefix: 'hl-api',
})
