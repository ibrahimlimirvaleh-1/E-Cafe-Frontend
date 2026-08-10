import { clearAuthTokens, getAccessToken, getRefreshToken, saveAuthTokens } from '../auth/tokenStorage'
import { endpoints } from './endpoints'

export type ApiResult<T> = {
  success: boolean
  statusCode: number
  message: string
  data: T
  traceId?: string
  errors?: Record<string, string[]>
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api/v1'

type RequestOptions = RequestInit & {
  skipAuthRefresh?: boolean
}

export async function httpClient<T>(path: string, init?: RequestOptions): Promise<ApiResult<T>> {
  const response = await sendRequest(path, init)

  if (response.status === 401 && !init?.skipAuthRefresh) {
    const refreshed = await refreshAccessToken()
    if (refreshed) {
      return httpClient<T>(path, { ...init, skipAuthRefresh: true })
    }
  }

  return parseResponse<T>(response)
}

async function sendRequest(path: string, init?: RequestOptions) {
  const { skipAuthRefresh: _skipAuthRefresh, ...requestInit } = init ?? {}
  const token = getAccessToken()
  const headers = new Headers(requestInit.headers)
  const isFormData = requestInit.body instanceof FormData

  if (!isFormData && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  return fetch(`${API_BASE_URL}${path}`, {
    ...requestInit,
    headers,
  })
}

async function parseResponse<T>(response: Response): Promise<ApiResult<T>> {
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

async function refreshAccessToken() {
  const refreshToken = getRefreshToken()
  if (!refreshToken) {
    clearAuthTokens()
    return false
  }

  try {
    const response = await fetch(`${API_BASE_URL}${endpoints.auth.refresh}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'same-origin',
      body: JSON.stringify({ refreshToken }),
    })

    if (!response.ok) {
      clearAuthTokens()
      return false
    }

    const payload = await response.json().catch(() => null)
    const result = normalizeApiResult<{ accessToken: string; refreshToken: string }>(payload, response.status, response.ok)

    if (!result.data?.accessToken || !result.data?.refreshToken) {
      clearAuthTokens()
      return false
    }

    saveAuthTokens(result.data)
    return true
  } catch {
    clearAuthTokens()
    return false
  }
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

export { API_BASE_URL }
