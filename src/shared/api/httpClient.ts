import { clearAuthTokens, getAccessToken, hasManualLogoutMarker, saveAuthTokens } from '../auth/tokenStorage'
import type { AuthTokens } from '../auth/tokenStorage'
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
const API_PUBLIC_ORIGIN = import.meta.env.VITE_PUBLIC_API_ORIGIN
const AUTH_EXPIRED_NOTIFICATION_THROTTLE_MS = 2000

let refreshRequestPromise: Promise<AuthTokens | null> | null = null
let lastAuthExpiredNotificationAt = 0

type RequestOptions = RequestInit & {
  authErrorMessage?: string
  skipAuthRefresh?: boolean
  suppressAuthExpiredEvent?: boolean
}

export async function httpClient<T>(path: string, init?: RequestOptions): Promise<ApiResult<T>> {
  const response = await sendRequest(path, init)

  if (response.status === 401 && !init?.skipAuthRefresh) {
    const refreshed = await refreshAccessToken()
    if (refreshed) {
      return httpClient<T>(path, { ...init, skipAuthRefresh: true })
    }
  }

  return parseResponse<T>(response, init)
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
    throw buildApiError(result, response.status, !init?.suppressAuthExpiredEvent, init?.authErrorMessage)
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
  const {
    authErrorMessage: _authErrorMessage,
    skipAuthRefresh: _skipAuthRefresh,
    suppressAuthExpiredEvent: _suppressAuthExpiredEvent,
    ...requestInit
  } = init ?? {}
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
    credentials: requestInit.credentials ?? 'include',
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

  if (typeof API_PUBLIC_ORIGIN === 'string' && API_PUBLIC_ORIGIN.trim()) {
    return API_PUBLIC_ORIGIN.trim().replace(/\/$/, '')
  }

  if (typeof window !== 'undefined' && window.location.origin) {
    return window.location.origin
  }

  return ''
}

async function parseResponse<T>(response: Response, init?: RequestOptions): Promise<ApiResult<T>> {
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
    throw buildApiError(result, response.status, !init?.suppressAuthExpiredEvent, init?.authErrorMessage)
  }

  return result
}

export async function refreshAccessToken(options?: { notifyOnFailure?: boolean }): Promise<AuthTokens | null> {
  if (hasManualLogoutMarker()) {
    return null
  }

  const shouldNotify = options?.notifyOnFailure ?? true

  refreshRequestPromise ??= requestRefreshAccessToken().finally(() => {
    refreshRequestPromise = null
  })

  const tokens = await refreshRequestPromise

  if (!tokens && shouldNotify) {
    notifyAuthExpiredOnce('Sessiya etibarsızdır və ya hesabınız deaktiv edilib. Zəhmət olmasa yenidən daxil olun.')
  }

  return tokens
}

async function requestRefreshAccessToken(): Promise<AuthTokens | null> {
  try {
    const response = await fetch(`${API_BASE_URL}${endpoints.auth.refresh}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    })

    if (!response.ok) {
      clearAuthTokens()
      return null
    }

    const payload = await response.json().catch(() => null)
    const result = normalizeApiResult<{ accessToken: string }>(payload, response.status, response.ok)

    if (!result.data?.accessToken) {
      clearAuthTokens()
      return null
    }

    saveAuthTokens(result.data)
    return result.data
  } catch {
    clearAuthTokens()
    return null
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

function buildApiError(result: ApiResult<unknown>, statusCode: number, shouldNotifyAuthExpired = true, authErrorMessage?: string) {
  const details = extractErrorDetails(result.errors)
  const message = resolveApiErrorMessage(result, statusCode, details, authErrorMessage)

  if (statusCode === 401 && shouldNotifyAuthExpired) {
    clearAuthTokens()
    notifyAuthExpired(message)
  }

  return new ApiError(message, statusCode, details, result.code, result.traceId)
}

function resolveApiErrorMessage(result: ApiResult<unknown>, statusCode: number, details: ApiErrorDetail[], authErrorMessage?: string) {
  if (details.length > 0) {
    return 'Form məlumatlarında səhv var. Zəhmət olmasa işarələnmiş sahələri yoxlayın.'
  }

  if (statusCode === 401 && authErrorMessage) {
    return authErrorMessage
  }

  if (result.code) {
    return translateErrorCode(result.code) || statusMessage(statusCode)
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

function translateErrorCode(code: string) {
  const normalized = code.trim()
  const messages: Record<string, string> = {
    ActiveStaffAssignmentNotFound: 'Aktiv əməkdaş tapılmadı.',
    BranchAlreadyExistsInRestaurantGroup: 'Bu restoranda eyni adlı filial artıq mövcuddur.',
    CannotDeactivateOwnAccount: 'Öz hesabınızı deaktiv edə bilməzsiniz.',
    CategoryIsEmpty: 'Bu restoran üçün aktiv kateqoriya yoxdur. Menyu elementi əlavə etmək üçün əvvəl kateqoriya yaradın.',
    CategoryNotFound: 'Seçilmiş kateqoriya tapılmadı. Kateqoriyanı yenidən seçin və ya əvvəl aktiv kateqoriya yaradın.',
    CategoryDoesNotBelongToRestaurant: 'Seçilmiş kateqoriya bu restorana aid deyil.',
    CategoryNameAlreadyExists: 'Bu adda kateqoriya artıq mövcuddur.',
    FileContentTypeMismatch: 'Faylın məzmunu seçilən fayl formatı ilə uyğun deyil.',
    FileExtensionMismatch: 'Faylın uzantısı seçilən fayl formatı ilə uyğun deyil.',
    FileNotFoundOrAlreadyAttached: 'Seçilmiş fayl tapılmadı və ya artıq istifadə olunub.',
    FileTooLarge: 'Fayl çox böyükdür. Daha kiçik fayl seçin.',
    UnsupportedFileType: 'Bu fayl formatı dəstəklənmir.',
    InvalidCredentials: 'Email və ya şifrə yanlışdır.',
    InvalidRestaurantId: 'Restoran seçimi düzgün deyil.',
    InvalidRoleId: 'Rol seçimi düzgün deyil.',
    RestaurantActiveContractRequired: 'Bu restoranın aktiv müqaviləsi yoxdur. Əvvəl müqaviləni aktivləşdirin, sonra əməliyyatı icra edin.',
    RestaurantAlreadyHasActiveContract: 'Bu restoranın aktiv müqaviləsi var. Yeni müqavilə yaratmaq üçün əvvəl cari müqaviləni dayandırın.',
    RestaurantAlreadyHasActiveOwner: 'Bu restoran üçün artıq aktiv sahibkar təyin edilib.',
    RestaurantOwnerNotAssigned: 'Restorana aktiv sahibkar təyin edilməyib. Müqaviləni təsdiqə göndərmək üçün əvvəl restoran sahibkarı əlavə edin.',
    RestaurantEmailAlreadyExists: 'Bu email ilə restoran artıq mövcuddur.',
    RestaurantGroupInactive: 'Seçilmiş restoran qrupu aktiv deyil.',
    RestaurantGroupNameAlreadyExists: 'Bu adda restoran qrupu artıq mövcuddur.',
    RestaurantGroupRequired: 'Restoran qrupu seçilməlidir.',
    RestaurantNameAlreadyExists: 'Bu adda restoran artıq mövcuddur.',
    RestaurantPhoneAlreadyExists: 'Bu telefonla restoran artıq mövcuddur.',
    RestaurantScopedRoleRequiresAssignment: 'Bu rol üçün aktiv restoran təyinatı olmalıdır.',
    RoleAlreadyAssigned: 'Bu istifadəçiyə həmin rol artıq verilib.',
    StaffAssignmentNotFound: 'Əməkdaş təyinatı tapılmadı.',
    StaffNotFound: 'Əməkdaş tapılmadı.',
    TableAlreadyExists: 'Bu nömrəli masa artıq mövcuddur.',
    TableNameAlreadyExists: 'Bu adda masa artıq mövcuddur.',
    UserEmailAlreadyExists: 'Bu email ilə istifadəçi artıq mövcuddur.',
    UserPhoneAlreadyExists: 'Bu telefon nömrəsi ilə istifadəçi artıq mövcuddur.',
    UserAlreadyExists: 'Bu email və ya telefon nömrəsi ilə istifadəçi artıq mövcuddur.',
  }

  return messages[normalized]
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
    'request failed with status 429': 'Çox sayda cəhd edildi. Bir az sonra yenidən yoxlayın.',
    'request failed with status 403': 'Bu əməliyyatı icra etmək üçün icazəniz yoxdur.',
    'request failed with status 404': 'Axtarılan məlumat tapılmadı.',
    'request failed with status 409': 'Bu əməliyyat mövcud biznes qaydası ilə ziddiyyət təşkil edir.',
    'request failed with status 413': 'Fayl çox böyükdür. Maksimum icazə verilən ölçüdə fayl seçin.',
    'request failed with status 500': 'Serverdə xəta baş verdi. Bir az sonra yenidən yoxlayın.',
    'hesabınız deaktiv edilib. sistemə girişiniz dayandırıldı.': 'Hesabınız deaktiv edilib. Sistemə girişiniz dayandırıldı.',
    'only platform admin can manage restaurant owner accounts.': 'Yalnız platform administratoru sahibkar hesablarını idarə edə bilər.',
    'restaurant already has an active owner.': 'Bu restoran üçün artıq aktiv sahibkar təyin edilib.',
    'restaurant already has an active contract. terminate or expire the current contract before creating a new one.': 'Bu restoranın aktiv müqaviləsi var. Yeni müqavilə yaratmaq üçün əvvəl cari müqaviləni dayandırın.',
    'restaurant owner is not assigned.': 'Restorana aktiv sahibkar təyin edilməyib. Müqaviləni təsdiqə göndərmək üçün əvvəl restoran sahibkarı əlavə edin.',
    'restaurant-scoped role requires an active restaurant assignment.': 'Bu rol üçün aktiv restoran təyinatı olmalıdır.',
    'table with the same number already exists.': 'Bu nömrəli masa artıq mövcuddur.',
    'table already exists.': 'Bu nömrəli masa artıq mövcuddur.',
    'category already exists.': 'Bu adda kateqoriya artıq mövcuddur.',
    'restaurant already exists.': 'Bu restoran artıq mövcuddur.',
    'user with this email already exists': 'Bu email ilə istifadəçi artıq mövcuddur.',
    'user with this email already exists.': 'Bu email ilə istifadəçi artıq mövcuddur.',
    'user with this phone already exists': 'Bu telefon nömrəsi ilə istifadəçi artıq mövcuddur.',
    'user with this phone already exists.': 'Bu telefon nömrəsi ilə istifadəçi artıq mövcuddur.',
    'email or phone already used': 'Email və ya telefon nömrəsi artıq istifadə olunub.',
    'email or phone already used.': 'Email və ya telefon nömrəsi artıq istifadə olunub.',
    'file content does not match the declared mime type.': 'Faylın məzmunu seçilən fayl formatı ilə uyğun deyil.',
    'file extension does not match the allowed mime type.': 'Faylın uzantısı seçilən fayl formatı ilə uyğun deyil.',
    'unsupported file type.': 'Bu fayl formatı dəstəklənmir.',
    'business rule violation': 'Bu əməliyyat mövcud qaydalara uyğun deyil.',
    'validation failed': 'Form məlumatlarında səhv var.',
  }

  if (messages[lower]) {
    return messages[lower]
  }

  const businessMessage = lower.replace(/^business rule violation[:\s-]*/i, '').trim()
  if (businessMessage && businessMessage !== lower) {
    return translateMessage(businessMessage, statusCode)
  }

  if (lower.includes('email') && lower.includes('already')) {
    return 'Bu email artıq istifadə olunub.'
  }

  if (lower.includes('phone') && lower.includes('already')) {
    return 'Bu telefon nömrəsi artıq istifadə olunub.'
  }

  if ((lower.includes('table') || lower.includes('masa')) && lower.includes('already')) {
    return 'Bu masa artıq mövcuddur.'
  }

  if ((lower.includes('category') || lower.includes('kateqoriya')) && lower.includes('already')) {
    return 'Bu kateqoriya artıq mövcuddur.'
  }

  if ((lower.includes('restaurant') || lower.includes('restoran')) && lower.includes('already')) {
    return 'Bu restoran məlumatı artıq mövcuddur.'
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
  if (statusCode === 413) return 'Fayl çox böyükdür. Maksimum icazə verilən ölçüdə fayl seçin.'
  if (statusCode === 429) return 'Çox sayda cəhd edildi. Bir az sonra yenidən yoxlayın.'
  if (statusCode >= 500) return 'Serverdə xəta baş verdi. Bir az sonra yenidən yoxlayın.'
  return `Sorğu icra olunmadı. Status: ${statusCode}`
}

function notifyAuthExpired(message?: string) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('ecafe:auth-expired', { detail: { message } }))
  }
}

function notifyAuthExpiredOnce(message?: string) {
  const now = Date.now()

  if (now - lastAuthExpiredNotificationAt < AUTH_EXPIRED_NOTIFICATION_THROTTLE_MS) {
    return
  }

  lastAuthExpiredNotificationAt = now
  notifyAuthExpired(message)
}

export { API_BASE_URL, getApiOrigin }
