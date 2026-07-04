import { createAlova } from 'alova'
import { xhrRequestAdapter } from '@alova/adapter-xhr'
import { ApiError } from '../lib/api/error.ts'

export const api = createAlova({
  baseURL: '',
  requestAdapter: xhrRequestAdapter({ onCreate: xhr => { xhr.timeout = 10_000 } }),
  responded: {
    onSuccess: async (response) => {
      if (response.status >= 400) {
        throw new ApiError(`API ${response.status}: ${String(response.data ?? '')}`, response.status, 'API_ERROR')
      }
      return response.data
    },
  },
})
