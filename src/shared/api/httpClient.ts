import { clearAuthTokens, getAccessToken, getRefreshToken, saveAuthTokens } from '../auth/tokenStorage'
import { endpoints } from './endpoints'

export type ApiResult<T> = {
  success: boolean
  statusCode: number
  message: string
  data: T
  traceId?: string
  errors?: unknown
  code?: string
}

export type ApiErrorDetail = {
  field?: string
  label?: string
  message: string
}

export class ApiError extends Error {
  code?: string
  details: ApiErrorDetail[]
  statusCode: number
  traceId?: string

  constructor(message: string, statusCode: number, details: ApiErrorDetail[] = [], code?: string, traceId?: string) {
    super(message)
    this.name = 'ApiError'
    this.statusCode = statusCode
    this.details = details
    this.code = code
    this.traceId = traceId
  }
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api/v1'
const API_PUBLIC_ORIGIN = import.meta.env.VITE_PUBLIC_API_ORIGIN ?? 'http://localhost:8080'

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

export async function fetchProtectedBlob(pathOrUrl: string, init?: RequestOptions): Promise<Blob> {
  const response = await sendBlobRequest(pathOrUrl, init)

  if (response.status === 401 && !init?.skipAuthRefresh) {
    const refreshed = await refreshAccessToken()
    if (refreshed) {
      return fetchProtectedBlob(pathOrUrl, { ...init, skipAuthRefresh: true })
    }
  }

  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    const result = normalizeApiResult<unknown>(payload, response.status, response.ok)
    throw buildApiError(result, response.status)
  }

  return response.blob()
}

async function sendRequest(path: string, init?: RequestOptions) {
  return sendApiRequest(`${API_BASE_URL}${path}`, init)
}

async function sendBlobRequest(pathOrUrl: string, init?: RequestOptions) {
  return sendApiRequest(resolveApiUrl(pathOrUrl), init)
}

async function sendApiRequest(url: string, init?: RequestOptions) {
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

  return fetch(url, {
    ...requestInit,
    headers,
  })
}

function resolveApiUrl(pathOrUrl: string) {
  if (/^https?:\/\//i.test(pathOrUrl)) {
    const url = new URL(pathOrUrl)

    if (!/^https?:\/\//i.test(API_BASE_URL) && url.pathname.startsWith('/api/')) {
      return `${url.pathname}${url.search}`
    }

    return pathOrUrl
  }

  if (pathOrUrl.startsWith('/api/')) {
    return /^https?:\/\//i.test(API_BASE_URL) ? resolveApiRootUrl(pathOrUrl) : pathOrUrl
  }

  return `${API_BASE_URL}${pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`}`
}

function resolveApiRootUrl(path: string) {
  return `${getApiOrigin()}${path}`
}

function getApiOrigin() {
  if (/^https?:\/\//i.test(API_BASE_URL)) {
    return new URL(API_BASE_URL).origin
  }

  return API_PUBLIC_ORIGIN.replace(/\/$/, '')
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
    throw buildApiError(result, response.status)
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

export function normalizeCaughtApiError(error: unknown, fallbackMessage = 'Sorğu icra olunmadı.') {
  if (error instanceof ApiError) {
    const details =
      error.details.length === 0 && error.statusCode >= 500 && error.traceId
        ? [{ label: 'İz kodu', message: error.traceId }]
        : error.details

    return {
      message: error.message,
      details,
      traceId: error.traceId,
      statusCode: error.statusCode,
    }
  }

  if (error instanceof Error) {
    return {
      message: translateMessage(error.message) || fallbackMessage,
      details: [] as ApiErrorDetail[],
      traceId: undefined,
      statusCode: undefined,
    }
  }

  return {
    message: fallbackMessage,
    details: [] as ApiErrorDetail[],
    traceId: undefined,
    statusCode: undefined,
  }
}

function buildApiError(result: ApiResult<unknown>, statusCode: number) {
  const details = extractErrorDetails(result.errors)
  const message = resolveApiErrorMessage(result, statusCode, details)

  if (statusCode === 401) {
    clearAuthTokens()
    notifyAuthExpired()
  }

  return new ApiError(message, statusCode, details, result.code, result.traceId)
}

function resolveApiErrorMessage(result: ApiResult<unknown>, statusCode: number, details: ApiErrorDetail[]) {
  if (details.length > 0) {
    return 'Form məlumatlarında səhv var. Zəhmət olmasa işarələnmiş sahələri yoxlayın.'
  }

  if (result.message) {
    return translateMessage(result.message, statusCode)
  }

  return statusMessage(statusCode)
}

function extractErrorDetails(errors: unknown): ApiErrorDetail[] {
  if (!errors) {
    return []
  }

  if (Array.isArray(errors)) {
    return errors
      .map<ApiErrorDetail | null>((error) => {
        if (typeof error === 'string') {
          return { message: translateMessage(error, 400) }
        }

        if (error && typeof error === 'object' && 'message' in error) {
          const rawField = 'field' in error ? String((error as { field?: unknown }).field ?? '') : ''
          return {
            field: rawField || undefined,
            label: rawField ? fieldLabel(rawField) : undefined,
            message: translateMessage(String((error as { message?: unknown }).message ?? ''), 400),
          }
        }

        return null
      })
      .filter((detail): detail is ApiErrorDetail => Boolean(detail))
  }

  if (typeof errors === 'object') {
    return Object.entries(errors as Record<string, unknown>).flatMap(([field, value]) => {
      const values = Array.isArray(value) ? value : [value]
      return values
        .map((item) => String(item ?? ''))
        .filter(Boolean)
        .map((message) => ({
          field,
          label: fieldLabel(field),
          message: translateMessage(message, 400),
        }))
    })
  }

  return []
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
    code: payload && typeof payload === 'object' && 'code' in payload ? String((payload as { code?: string }).code ?? '') : undefined,
    traceId:
      payload && typeof payload === 'object' && 'traceId' in payload ? String((payload as { traceId?: string }).traceId ?? '') : undefined,
    errors: payload && typeof payload === 'object' && 'errors' in payload ? (payload as { errors?: unknown }).errors : undefined,
  }
}

function fieldLabel(field: string) {
  const normalized = field.replace(/Request\.|Command\./gi, '')
  const labels: Record<string, string> = {
    BasePrice: 'Qiymət',
    BranchName: 'Filial adı',
    CancellationWindowMinutes: 'Ləğv müddəti',
    CategoryId: 'Kateqoriya',
    CommissionPercent: 'Komissiya faizi',
    Description: 'Tərkib',
    Email: 'Email',
    EndDate: 'Bitmə tarixi',
    File: 'Fayl',
    FileId: 'Fayl',
    FileIds: 'Fayllar',
    Location: 'Məkan',
    LowStockThreshold: 'Limit',
    Name: 'Ad',
    Password: 'Parol',
    PaymentPolicyId: 'Ödəniş qaydası',
    Phone: 'Telefon',
    Quantity: 'Miqdar',
    QuantityOnHand: 'Miqdar',
    RestaurantGroupId: 'Restoran qrupu',
    RestaurantGroupName: 'Restoran qrupu',
    RestaurantId: 'Restoran',
    RoleId: 'Rol',
    SortOrder: 'Sıra',
    StaffSettlementPeriod: 'Hesablaşma dövrü',
    StartDate: 'Başlama tarixi',
    StatusId: 'Status',
    Surname: 'Soyad',
    TableNo: 'Masa nömrəsi',
    UnitId: 'Ölçü vahidi',
  }

  return labels[normalized] ?? normalized
}

function translateMessage(message: string, statusCode?: number) {
  const normalized = message.trim()
  const lower = normalized.toLowerCase()
  const messages: Record<string, string> = {
    'request failed with status 400': 'Sorğu düzgün deyil. Məlumatları yoxlayıb yenidən cəhd edin.',
    'request failed with status 401': 'Sessiya bitib. Zəhmət olmasa yenidən daxil olun.',
    'request failed with status 403': 'Bu əməliyyatı icra etmək üçün icazəniz yoxdur.',
    'request failed with status 404': 'Axtarılan məlumat tapılmadı.',
    'request failed with status 409': 'Bu əməliyyat mövcud biznes qaydası ilə ziddiyyət təşkil edir.',
    'request failed with status 500': 'Serverdə xəta baş verdi. Bir az sonra yenidən yoxlayın.',
    'only platform admin can manage restaurant owner accounts.': 'Yalnız platform administratoru sahibkar hesablarını idarə edə bilər.',
    'restaurant already has an active owner.': 'Bu restoran üçün artıq aktiv sahibkar təyin edilib.',
    'user with this email already exists': 'Bu email ilə istifadəçi artıq mövcuddur.',
    'validation failed': 'Form məlumatlarında səhv var.',
  }

  if (messages[lower]) {
    return messages[lower]
  }

  if (statusCode && statusCode >= 400) {
    return statusMessage(statusCode)
  }

  return normalized
}

function statusMessage(statusCode: number) {
  if (statusCode === 400) return 'Sorğu düzgün deyil. Məlumatları yoxlayıb yenidən cəhd edin.'
  if (statusCode === 401) return 'Sessiya bitib. Zəhmət olmasa yenidən daxil olun.'
  if (statusCode === 403) return 'Bu əməliyyatı icra etmək üçün icazəniz yoxdur.'
  if (statusCode === 404) return 'Axtarılan məlumat tapılmadı.'
  if (statusCode === 409) return 'Bu əməliyyat mövcud biznes qaydası ilə ziddiyyət təşkil edir.'
  if (statusCode >= 500) return 'Serverdə xəta baş verdi. Bir az sonra yenidən yoxlayın.'
  return `Sorğu icra olunmadı. Status: ${statusCode}`
}

function notifyAuthExpired() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('ecafe:auth-expired'))
  }
}

export { API_BASE_URL, getApiOrigin }
