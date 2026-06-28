import { ApiError } from './api-error.ts'

export async function tryCatch<T>(
  promise: Promise<T>,
): Promise<{ data: T; error: null } | { data: null; error: ApiError }> {
  try {
    const data = await promise
    return { data, error: null }
  } catch (err) {
    if (err instanceof ApiError) {
      return { data: null, error: err }
    }
    return {
      data: null,
      error: new ApiError(err instanceof Error ? err.message : String(err), 0, 'UNEXPECTED'),
    }
  }
}
