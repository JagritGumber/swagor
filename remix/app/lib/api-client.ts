import { createAlova } from 'alova'
import { xhrRequestAdapter } from '@alova/adapter-xhr'

export const api = createAlova({
  baseURL: '',
  requestAdapter: xhrRequestAdapter(),
  responded: {
    onSuccess: async (response) => {
      if (response.status >= 400) {
        const text = String(response.data ?? '')
        const body = text ? JSON.parse(text) : {}
        throw new Error(body.error ?? `HTTP ${response.status}`)
      }
      const text = String(response.data ?? '')
      return text ? JSON.parse(text) : null
    },
  },
})
