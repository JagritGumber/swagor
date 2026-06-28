import { createAlova } from 'alova'
import { xhrRequestAdapter } from '@alova/adapter-xhr'
import { ApiError } from './error.ts'

export { ApiError }

export const api = createAlova({
  baseURL: '',
  requestAdapter: xhrRequestAdapter(),
  responded: {
    onSuccess: async (response) => {
      const data = response.data
      if (response.status >= 400) {
        const msg = typeof data === 'object' && data !== null
          ? String((data as Record<string, unknown>).error ?? `HTTP ${response.status}`)
          : `HTTP ${response.status}`
        throw new ApiError(msg, response.status)
      }
      return data
    },
  },
})
