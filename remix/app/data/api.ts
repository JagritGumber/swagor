import { createAlova } from 'alova'
import { xhrRequestAdapter } from '@alova/adapter-xhr'
import { ApiError } from '../lib/api/error.ts'
import type { Candle } from '../types/candles.ts'
import type { ApiResponse } from '../lib/api/response.ts'

export const api = createAlova({
  baseURL: '',
  requestAdapter: xhrRequestAdapter({ onCreate: xhr => { xhr.timeout = 10_000 } }),
  responded: {
    onSuccess: async (response) => {
      if (response.status >= 400) {
        throw new ApiError(`API ${response.status}: ${String(response.data ?? '')}`, response.status, 'API_ERROR')
      }
      const body = response.data as Record<string, unknown> | undefined
      if (body && body.ok === false) {
        const err = body.error as { code?: string; message?: string } | undefined
        throw new ApiError(err?.message ?? 'Unknown error', response.status, err?.code ?? 'API_ERROR')
      }
      return response.data
    },
    onError: async (err, method) => {
      const retries = (method as { config?: { extra?: { retries?: number } } }).config?.extra?.retries ?? 0
      if (retries < 2) {
        const config = method.config as { extra?: { retries?: number } }
        if (!config.extra) config.extra = {}
        config.extra.retries = retries + 1
        await new Promise(r => setTimeout(r, 1000 * (retries + 1)))
        return method.send()
      }
      throw err
    },
  },
})

export type CandlesResponse = ApiResponse<{ candles: Candle[] }>
export type NonceResponse = ApiResponse<{ nonce: string }>
export type LoginResponse = ApiResponse<{ redirect: string }>
export type BalanceResponse = ApiResponse<{ balanceUsd: number }>

export function getCandles(asset: string, interval: string, start: number, end: number) {
  return api.Get<CandlesResponse>('/api/candles', {
    name: `candles-${asset}-${interval}-${start}-${end}`,
    params: { asset, interval, start: String(start), end: String(end) },
  })
}

export function getNonce(address: string) {
  return api.Get<NonceResponse>('/api/nonce', {
    name: `nonce-${address}`,
    params: { address },
  })
}

export function postLogin(address: string, signature: string, nonce: string) {
  return api.Post<LoginResponse>('/login',
    { address, signature, nonce },
    { name: 'login' },
  )
}

export function fetchBalance() {
  return api.Get<BalanceResponse>('/api/balance', {
    name: 'balance',
  })
}
