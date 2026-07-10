import { createFileRoute } from '@tanstack/react-router'
import { generateNonce } from '@/data/nonce.ts'
import { apiSuccess, apiError } from '@/lib/api/response.ts'

export const Route = createFileRoute('/api/nonce')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url)
        const address = url.searchParams.get('address')
        if (!address) {
          return apiError('MISSING_ADDRESS', 'address parameter required', 400)
        }
        const nonce = generateNonce(address)
        return apiSuccess({ nonce })
      },
    },
  },
})
