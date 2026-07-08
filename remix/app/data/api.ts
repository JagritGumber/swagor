import { ApiError } from '../lib/api/error.ts'
import type { Candle } from '@shared/candle'
import type { ApiResponse } from '../lib/api/response.ts'

async function request<T>(url: string, options: RequestInit): Promise<T> {
  const res = await fetch(url, { ...options, signal: AbortSignal.timeout(10_000) })
  if (!res.ok) {
    throw new ApiError(`API ${res.status}: ${await res.text()}`, res.status, 'API_ERROR')
  }
  const body = await res.json() as Record<string, unknown> | undefined
  if (body && body.ok === false) {
    const err = body.error as { code?: string; message?: string } | undefined
    throw new ApiError(err?.message ?? 'Unknown error', res.status, err?.code ?? 'API_ERROR')
  }
  return body as T
}

export type CandlesResponse = ApiResponse<{ candles: Candle[] }>
export type NonceResponse = ApiResponse<{ nonce: string }>
export type LoginResponse = ApiResponse<{ redirect: string }>
export type BalanceResponse = ApiResponse<{ balanceUsd: number }>

export function getCandles(asset: string, interval: string, start: number, end: number) {
  const params = new URLSearchParams({ asset, interval, start: String(start), end: String(end) })
  return request<CandlesResponse>(`/api/candles?${params}`, { method: 'GET' })
}

export function getNonce(address: string) {
  const params = new URLSearchParams({ address })
  return request<NonceResponse>(`/api/nonce?${params}`, { method: 'GET' })
}

export function postLogin(address: string, signature: string, nonce: string) {
  return request<LoginResponse>('/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address, signature, nonce }),
  })
}

export function fetchBalance() {
  return request<BalanceResponse>('/api/balance', { method: 'GET' })
}
