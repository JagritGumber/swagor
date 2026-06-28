import { createAlova } from 'alova'
import { xhrRequestAdapter } from '@alova/adapter-xhr'

export class ApiError extends Error {
  status: number
  code: string

  constructor(message: string, status: number, code?: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code ?? 'UNKNOWN'
  }
}

export const api = createAlova({
  baseURL: '',
  requestAdapter: xhrRequestAdapter(),
  responded: {
    onSuccess: async (response) => {
      const text = String(response.data ?? '')
      if (response.status >= 400) {
        const body = text ? JSON.parse(text) : {}
        throw new ApiError(body.error ?? `HTTP ${response.status}`, response.status, body.code)
      }
      return text ? JSON.parse(text) : null
    },
  },
})
