import { createAlova } from 'alova'
import { xhrRequestAdapter } from '@alova/adapter-xhr'
import { ApiError } from './api-error.ts'

export { ApiError }

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
