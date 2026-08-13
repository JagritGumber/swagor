export interface ApiSuccess<T> {
  ok: true
  data: T
}

export interface ApiErrorBody {
  ok: false
  error: {
    code: string
    message: string
  }
}

export type ApiResponse<T> = ApiSuccess<T> | ApiErrorBody

export function apiSuccess<T>(data: T): Response {
  return Response.json({ ok: true, data })
}

export function apiError(code: string, message: string, status: number): Response {
  return Response.json({ ok: false, error: { code, message } }, { status })
}
