export type ApiResult<T> = {
  success: boolean
  statusCode: number
  message: string
  data: T
  traceId?: string
  errors?: Record<string, string[]>
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api/v1'
const ACCESS_TOKEN_KEY = 'ecafe_access_token'

function getAccessToken() {
  return localStorage.getItem(ACCESS_TOKEN_KEY)
}

export async function httpClient<T>(path: string, init?: RequestInit): Promise<ApiResult<T>> {
  const token = getAccessToken()
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  })

  if (response.status === 204) {
    return {
      success: response.ok,
      statusCode: response.status,
      message: '',
      data: undefined as T,
    }
  }

  const payload = await response.json().catch(() => null)
  const result = normalizeApiResult<T>(payload, response.status, response.ok)

  if (!response.ok) {
    throw new Error(result.message || `Request failed with status ${response.status}`)
  }

  return result
}

function normalizeApiResult<T>(payload: unknown, statusCode: number, success: boolean): ApiResult<T> {
  if (payload && typeof payload === 'object' && 'data' in payload) {
    return payload as ApiResult<T>
  }

  const message = payload && typeof payload === 'object' && 'message' in payload ? String((payload as { message?: string }).message ?? '') : ''

  return {
    success,
    statusCode,
    message,
    data: payload as T,
  }
}

export function saveAccessToken(token: string) {
  localStorage.setItem(ACCESS_TOKEN_KEY, token)
}

export function clearAccessToken() {
  localStorage.removeItem(ACCESS_TOKEN_KEY)
}

export { API_BASE_URL, ACCESS_TOKEN_KEY }
