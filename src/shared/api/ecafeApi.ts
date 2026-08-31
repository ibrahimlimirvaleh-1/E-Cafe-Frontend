import {
  contracts,
  getAdminRows,
  getRestaurant,
  menuCategories,
  menuItems,
  orders,
  payments,
  reservations,
  restaurants,
  settlements,
  staff,
  tables,
} from '../../entities/mockData'
import type {
  AdminModuleKey,
  AdminRow,
  AuditLogEntry,
  InventoryItem,
  InventoryMovement,
  LookupItem,
  NotificationItem,
  OutboxMessage,
  Recipe,
  RestaurantContract,
  RestaurantGroup,
  UserProfile,
  WorkflowAction,
} from '../../entities/types'
import { endpoints } from './endpoints'
import { ApiError, fetchProtectedBlob, httpClient } from './httpClient'
import {
  categoryRow,
  contractRow,
  mapCategory,
  mapContract,
  mapMenuItem,
  mapRestaurant,
  mapStaff,
  mapTable,
  menuRow,
  restaurantRow,
  staffRow,
  tableRow,
} from './mappers'
import type { AnyRecord, PaginatedResponse } from './responseUtils'
import { asArray, asPaginated, bool, num, str } from './responseUtils'

type LoginRequest = {
  email: string
  password: string
}

type ForgotPasswordRequest = {
  email: string
}

type ResetPasswordRequest = {
  token: string
  password: string
  confirmPassword: string
}

type RegisterRequest = {
  name: string
  surname: string
  email: string
  phone: string
  password: string
}

type AuthResponse = {
  accessToken: string
  refreshToken?: string
}

type ContractRecord = {
  contract: RestaurantContract
  restaurantName: string
}

type ContractRecordQuery = {
  dateFrom?: string
  dateTo?: string
  expiringInDays?: string
  pageNumber?: number
  pageSize?: number
  restaurantId?: string
  search?: string
  statusId?: string
}

type CreateContractRequest = {
  startDate: string
  endDate?: string | null
  amount: number
  commissionPercent?: number | null
  staffSettlementPeriod?: number | null
  expiryReminderDaysBefore: number
  paymentPolicyId: number
}

type UpdateContractRequest = CreateContractRequest

type ApproveContractRequest = {
  hasAcceptedContractTerms: boolean
  acceptanceText: string
}

type WorkflowActionRequest = {
  action: WorkflowAction
  body?: unknown
}

function normalizeWorkflowActionEndpoint(endpoint: string) {
  const trimmedEndpoint = endpoint.trim()

  if (!trimmedEndpoint) {
    return ''
  }

  if (/^https?:\/\//i.test(trimmedEndpoint)) {
    const url = new URL(trimmedEndpoint)
    return normalizeWorkflowActionEndpoint(`${url.pathname}${url.search}`)
  }

  if (trimmedEndpoint.startsWith('/api/v1/')) {
    return trimmedEndpoint.slice('/api/v1'.length)
  }

  return trimmedEndpoint.startsWith('/') ? trimmedEndpoint : `/${trimmedEndpoint}`
}

type CreateRestaurantGroupRequest = {
  name: string
  legalName?: string
}

type CreateRestaurantRequest = {
  location: string
  latitude?: number | null
  longitude?: number | null
  placeId?: string | null
  phone: string
  email: string
  restaurantGroupId?: string
  restaurantGroupName?: string
  restaurantGroupLegalName?: string
  branchName?: string
  depositAmount: number
  cancellationWindowMinutes: number
  serviceFeePercent: number
  staffSettlementPeriod: number
  defaultWaiterTableLimit?: number | null
  fileIds?: number[]
}

type UpdateRestaurantRequest = CreateRestaurantRequest

export type GeocodeAddressResponse = {
  displayName: string
  latitude: number
  longitude: number
  placeId?: string | null
}

type CreateStaffRequest = {
  name: string
  surname: string
  email: string
  phone: string
  isActive: boolean
  restaurantId: string
  roleId: number
  fileId?: number | null
  serviceFeePercent?: number | null
  maxActiveTableCount?: number | null
}

type UpdateStaffRequest = Omit<CreateStaffRequest, 'restaurantId' | 'roleId'>

type CreateTableRequest = {
  tableNo: string
  name: string
  capacity: number
}

type UpdateTableRequest = CreateTableRequest & {
  isActive: boolean
}

type CopyTableRequest = {
  tableNo?: string
  name?: string
  copyCount?: string
  copies?: Array<{
    tableNo?: string
    name?: string
  }>
}

type CreateCategoryRequest = {
  name: string
  sortOrder?: number | null
}

type UpdateCategoryRequest = CreateCategoryRequest & {
  isActive: boolean
}

type CreateMenuItemRequest = {
  categoryId: string
  statusId: number
  name: string
  description: string
  basePrice: number
  isAvailable: boolean
  unavailableReason?: string
  fileId?: number | null
}

type CreateInventoryItemRequest = {
  name: string
  unitId: number
  quantityOnHand: number
  lowStockThreshold: number
}

type UpdateInventoryItemRequest = {
  name: string
  unitId: number
  lowStockThreshold: number
  isActive?: boolean
}

type CreateInventoryMovementRequest = {
  quantity: number
  unitId: number
  movementTypeId: number
  reason?: string | null
}

type InventoryQuery = {
  search?: string
  onlyLowStock?: boolean
  pageNumber?: number
  pageSize?: number
}

type InventoryMovementQuery = {
  pageNumber?: number
  pageSize?: number
}

type CreateRecipeRequest = {
  inventoryItemId: string
  quantity: number
  unitId: number
}

type UpdateRecipeRequest = CreateRecipeRequest & {
  isActive: boolean
}

type UpdateProfileRequest = {
  name: string
  surname: string
  email: string
  phone: string
  fileId?: number | null
}

type AuditLogQuery = {
  action?: string
  dateFrom?: string
  dateTo?: string
  pageNumber?: number
  pageSize?: number
}

type UploadedFile = {
  id: number
  token: string
  fileName: string
  url: string
  isAttached: boolean
}

async function safe<T>(request: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await request()
  } catch (error) {
    if (import.meta.env.VITE_ENABLE_API_FALLBACKS === 'true') {
      return fallback
    }

    throw error
  }
}

function extractAuthTokens(data: unknown): AuthResponse {
  if (!data || typeof data !== 'object') {
    return { accessToken: '', refreshToken: '' }
  }

  const record = data as AnyRecord
  return {
    accessToken: str(record.accessToken || record.token || record.jwtToken || record.jwt || record.access_token),
    refreshToken: str(record.refreshToken || record.refresh_token),
  }
}

async function listRestaurants(query = '') {
  const result = await httpClient<unknown>(`${endpoints.restaurants.adminList}${query}`)
  return asArray<AnyRecord>(result.data).map(mapRestaurant)
}

async function emptyListOnCategoryEmpty<T>(request: () => Promise<T[]>): Promise<T[]> {
  try {
    return await request()
  } catch (error) {
    if (error instanceof ApiError && error.code === 'CategoryIsEmpty') {
      return []
    }

    throw error
  }
}

async function fetchPublicMenu(restaurantId: string) {
  const result = await httpClient<unknown>(endpoints.publicRestaurant.menu(restaurantId))
  const categoryRecords = asArray<AnyRecord>(result.data)

  const categories = categoryRecords.map((category) => mapCategory(category, restaurantId))
  const items = categoryRecords.flatMap((category) => {
    const categoryId = str(category.id || category.categoryId)
    const categoryName = str(category.name)

    return asArray<AnyRecord>(category.items).map((item) =>
      mapMenuItem(
        {
          ...item,
          categoryId: item.categoryId || categoryId,
          categoryName: item.categoryName || categoryName,
        },
        restaurantId,
      ),
    )
  })

  return { categories, items }
}

function fallbackPublicMenu(restaurantId: string) {
  return {
    categories: menuCategories.filter((category) => category.restaurantId === restaurantId && category.isActive),
    items: menuItems.filter((item) => item.restaurantId === restaurantId && item.isActive),
  }
}

async function fetchContractRecords(query: ContractRecordQuery = {}): Promise<ContractRecord[]> {
  const restaurantList = (await listRestaurants()).filter(
    (restaurant) => !query.restaurantId || query.restaurantId === 'all' || restaurant.id === query.restaurantId,
  )
  const entries = await Promise.all(
    restaurantList.map(async (restaurant) => {
      const result = await httpClient<unknown>(buildContractListEndpoint(restaurant.id, query))
      const contractList = asArray<AnyRecord>(result.data).map((contract) => mapContract(contract, restaurant.id))

      return contractList.map((contract) => ({
        contract,
        restaurantName: restaurant.name,
      }))
    }),
  )

  return entries.flat()
}

function buildContractListEndpoint(restaurantId: string, query: ContractRecordQuery) {
  const params = new URLSearchParams()

  if (query.pageNumber) params.set('PageNumber', String(query.pageNumber))
  if (query.pageSize) params.set('PageSize', String(query.pageSize))
  if (query.search?.trim()) params.set('Search', query.search.trim())
  if (query.dateFrom) params.set('EndDateFrom', toUtcDayBoundary(query.dateFrom, 'start'))
  if (query.dateTo) params.set('EndDateTo', toUtcDayBoundary(query.dateTo, 'end'))
  if (query.expiringInDays) params.set('ExpiringInDays', query.expiringInDays)
  if (query.statusId && query.statusId !== 'all' && /^\d+$/.test(query.statusId)) params.set('StatusId', query.statusId)

  const search = params.toString()
  return search ? `${endpoints.contracts.paged(restaurantId)}?${search}` : endpoints.contracts.list(restaurantId)
}

function extractCreatedId(data: unknown) {
  if (data && typeof data === 'object') {
    const record = data as AnyRecord
    return str(record.id || record.contractId || record.data || record.value)
  }

  return str(data)
}

function appendIfPresent(formData: FormData, key: string, value: unknown) {
  if (value !== undefined && value !== null && value !== '') {
    formData.set(key, String(value))
  }
}

function mapLookup(record: AnyRecord): LookupItem {
  return {
    id: num(record.id || record.value),
    code: str(record.code || record.key || record.name),
    name: str(record.name || record.label || record.code),
    isStaffAssignable: record.isStaffAssignable == null ? undefined : bool(record.isStaffAssignable),
  }
}

function mapRestaurantGroup(record: AnyRecord): RestaurantGroup {
  return {
    id: str(record.id || record.restaurantGroupId),
    name: str(record.name),
    legalName: str(record.legalName || record.restaurantGroupLegalName),
    isActive: bool(record.isActive, true),
  }
}

function mapUploadedFile(record: AnyRecord): UploadedFile {
  return {
    id: num(record.id || record.fileId),
    token: str(record.token),
    fileName: str(record.fileName || record.name),
    url: str(record.url || record.fileUrl),
    isAttached: bool(record.isAttached),
  }
}

function mapGeocodeAddress(record: AnyRecord): GeocodeAddressResponse {
  return {
    displayName: str(record.displayName || record.DisplayName),
    latitude: num(record.latitude ?? record.Latitude),
    longitude: num(record.longitude ?? record.Longitude),
    placeId: str(record.placeId || record.PlaceId) || null,
  }
}

function mapUserProfile(record: AnyRecord): UserProfile {
  return {
    id: str(record.id || record.userId),
    name: str(record.name),
    surname: str(record.surname),
    email: str(record.email),
    phone: str(record.phone),
    isActive: bool(record.isActive, true),
    rating: num(record.rating),
    roleId: num(record.roleId),
    role: str(record.role || record.roleName),
    restaurantId: record.restaurantId ? str(record.restaurantId) : undefined,
    restaurantName: str(record.restaurantName),
    fileUrl: str(record.fileUrl) || undefined,
  }
}

function mapWorkflowAction(record: AnyRecord): WorkflowAction {
  return {
    code: str(record.code || record.actionCode),
    label: str(record.label || record.name || record.code),
    httpMethod: str(record.httpMethod || record.method, 'POST'),
    endpoint: str(record.endpoint || record.url),
    requiresConfirmation: bool(record.requiresConfirmation),
    sortOrder: num(record.sortOrder),
  }
}

function mapAuditLog(record: AnyRecord): AuditLogEntry {
  const occurredAt = str(record.occurredAt || record.createdAt || record.timestamp)
  const actorName = str(record.actorFullName || record.actorName || record.createdBy || record.userName)
  const entityName = str(record.entityName || record.entity)
  const entityId = str(record.entityId)
  const details = asArray(record.details).map((detailRecord) => {
    const detail = detailRecord as AnyRecord

    return {
      label: str(detail.label),
      value: detail.value == null ? undefined : str(detail.value),
      oldValue: detail.oldValue == null ? undefined : str(detail.oldValue),
      newValue: detail.newValue == null ? undefined : str(detail.newValue),
    }
  })

  return {
    id: str(record.id || record.auditLogId),
    action: str(record.action || record.actionName),
    actionDisplayName: str(record.actionDisplayName || record.actionName),
    entityName,
    entityId,
    entityDisplayName: str(record.entityDisplayName),
    actorUserId: record.actorUserId == null && record.userId == null ? undefined : str(record.actorUserId || record.userId),
    actorName,
    actorRoleId: record.actorRoleId == null ? undefined : num(record.actorRoleId),
    actorRoleName: str(record.actorRoleName || record.roleName),
    actorEmail: str(record.actorEmail),
    traceId: str(record.correlationId || record.traceId),
    ipAddress: str(record.ipAddress),
    userAgent: str(record.userAgent),
    occurredAt,
    createdAt: occurredAt,
    description: str(record.description || record.message || `${entityName} #${entityId}`),
    details,
  }
}

type OutboxMessageQuery = {
  statusId?: string
  channelId?: string
  search?: string
  dateFrom?: string
  dateTo?: string
  pageNumber?: number
  pageSize?: number
}

function toUtcDayBoundary(value: string | undefined, boundary: 'start' | 'end') {
  if (!value) {
    return ''
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value
  }

  const time = boundary === 'start' ? '00:00:00.000' : '23:59:59.999'
  return new Date(`${value}T${time}`).toISOString()
}

function buildAuditLogQuery(query: AuditLogQuery = {}) {
  const params = new URLSearchParams()

  if (query.action?.trim()) params.set('Action', query.action.trim())
  if (query.dateFrom) params.set('DateFrom', toUtcDayBoundary(query.dateFrom, 'start'))
  if (query.dateTo) params.set('DateTo', toUtcDayBoundary(query.dateTo, 'end'))
  if (query.pageNumber) params.set('PageNumber', String(query.pageNumber))
  if (query.pageSize) params.set('PageSize', String(query.pageSize))

  const search = params.toString()
  return search ? `?${search}` : ''
}

function mapNotification(record: AnyRecord): NotificationItem {
  return {
    id: str(record.id || record.notificationId),
    restaurantId: record.restaurantId == null ? undefined : str(record.restaurantId),
    title: str(record.title),
    message: str(record.message),
    typeId: num(record.typeId),
    typeName: str(record.typeName),
    channelId: num(record.channelId),
    statusId: num(record.statusId),
    isRead: bool(record.isRead),
    readAt: str(record.readAt) || undefined,
    payloadJson: str(record.payloadJson) || undefined,
    relatedEntityType: str(record.relatedEntityType) || undefined,
    relatedEntityId: record.relatedEntityId == null ? undefined : str(record.relatedEntityId),
    createdAt: str(record.createdAt),
  }
}

function mapOutboxMessage(record: AnyRecord): OutboxMessage {
  return {
    id: str(record.id),
    eventType: str(record.eventType),
    aggregateType: str(record.aggregateType),
    aggregateId: num(record.aggregateId),
    channelId: num(record.channelId),
    channel: str(record.channel),
    statusId: num(record.statusId),
    status: str(record.status),
    recipient: str(record.recipient),
    recipientName: str(record.recipientName),
    subject: str(record.subject),
    retryCount: num(record.retryCount),
    maxRetryCount: num(record.maxRetryCount),
    occurredAt: str(record.occurredAt),
    processedAt: str(record.processedAt) || undefined,
    lockedUntil: str(record.lockedUntil) || undefined,
    nextRetryAt: str(record.nextRetryAt) || undefined,
    lastError: str(record.lastError) || undefined,
    relatedEntityType: str(record.relatedEntityType) || undefined,
    relatedEntityId: record.relatedEntityId == null ? undefined : num(record.relatedEntityId),
  }
}

function buildOutboxQuery(query: OutboxMessageQuery = {}) {
  const params = new URLSearchParams()

  if (query.statusId) params.set('StatusId', query.statusId)
  if (query.channelId) params.set('ChannelId', query.channelId)
  if (query.search?.trim()) params.set('Search', query.search.trim())
  if (query.dateFrom) params.set('DateFrom', toUtcDayBoundary(query.dateFrom, 'start'))
  if (query.dateTo) params.set('DateTo', toUtcDayBoundary(query.dateTo, 'end'))
  if (query.pageNumber) params.set('PageNumber', String(query.pageNumber))
  if (query.pageSize) params.set('PageSize', String(query.pageSize))

  const search = params.toString()
  return search ? `?${search}` : ''
}

function buildInventoryQuery(query: InventoryQuery = {}) {
  const params = new URLSearchParams()

  if (query.search?.trim()) params.set('Search', query.search.trim())
  if (query.onlyLowStock) params.set('OnlyLowStock', 'true')
  if (query.pageNumber) params.set('PageNumber', String(query.pageNumber))
  if (query.pageSize) params.set('PageSize', String(query.pageSize))

  const search = params.toString()
  return search ? `?${search}` : ''
}

function buildInventoryMovementQuery(query: InventoryMovementQuery = {}) {
  const params = new URLSearchParams()

  if (query.pageNumber) params.set('PageNumber', String(query.pageNumber))
  if (query.pageSize) params.set('PageSize', String(query.pageSize))

  const search = params.toString()
  return search ? `?${search}` : ''
}

function emptyPaginated<T>(): PaginatedResponse<T> {
  return {
    items: [],
    pageIndex: 1,
    totalPages: 1,
    totalCount: 0,
    hasPreviousPage: false,
    hasNextPage: false,
  }
}

function mapInventoryItem(record: AnyRecord, restaurantId: string): InventoryItem {
  return {
    id: str(record.id || record.inventoryItemId),
    restaurantId: str(record.restaurantId, restaurantId),
    name: str(record.name),
    unitId: num(record.unitId),
    unitName: str(record.unitName),
    unitCode: str(record.unitCode || record.unit),
    quantityOnHand: num(record.quantityOnHand),
    lowStockThreshold: num(record.lowStockThreshold),
    isLowStock: bool(record.isLowStock),
    isActive: bool(record.isActive, true),
  }
}

function mapInventoryMovement(record: AnyRecord, restaurantId: string, inventoryItemId: string): InventoryMovement {
  return {
    id: str(record.id || record.inventoryMovementId),
    restaurantId: str(record.restaurantId, restaurantId),
    inventoryItemId: str(record.inventoryItemId, inventoryItemId),
    quantityChange: num(record.quantityChange),
    unitId: num(record.unitId),
    unitName: str(record.unitName),
    movementTypeId: num(record.movementTypeId),
    movementType: str(record.movementType || record.movementTypeName),
    movementTypeCode: str(record.movementTypeCode),
    reason: record.reason == null ? null : str(record.reason),
    quantityAfterMovement: num(record.quantityAfterMovement),
    createdAt: str(record.createdAt),
  }
}

function mapRecipe(record: AnyRecord, restaurantId: string, itemId: string): Recipe {
  return {
    id: str(record.id || record.recipeId),
    restaurantId: str(record.restaurantId, restaurantId),
    itemId: str(record.itemId, itemId),
    itemName: str(record.itemName),
    inventoryItemId: str(record.inventoryItemId),
    inventoryItemName: str(record.inventoryItemName),
    quantity: num(record.quantity),
    unitId: num(record.unitId),
    unitName: str(record.unitName),
    unitCode: str(record.unitCode),
    isActive: bool(record.isActive, true),
  }
}

export const ecafeApi = {
  auth: {
    login: async (request: LoginRequest) => {
      const result = await httpClient<unknown>(endpoints.auth.login, {
        method: 'POST',
        body: JSON.stringify(request),
        authErrorMessage: 'Email və ya parol yanlışdır.',
        skipAuthRefresh: true,
        suppressAuthExpiredEvent: true,
      })
      return extractAuthTokens(result.data)
    },
    register: async (request: RegisterRequest) => {
      const formData = new FormData()
      formData.set('Name', request.name)
      formData.set('Surname', request.surname)
      formData.set('Email', request.email)
      formData.set('Phone', request.phone)
      formData.set('Password', request.password)

      const result = await httpClient<unknown>(endpoints.auth.register, {
        method: 'POST',
        body: formData,
        skipAuthRefresh: true,
        suppressAuthExpiredEvent: true,
      })
      return extractAuthTokens(result.data)
    },
    setPassword: (request: { token: string; password: string; confirmPassword: string }) =>
      httpClient<unknown>(endpoints.auth.setPassword, {
        method: 'POST',
        body: JSON.stringify(request),
        skipAuthRefresh: true,
        suppressAuthExpiredEvent: true,
      }),
    forgotPassword: (request: ForgotPasswordRequest) =>
      httpClient<{ message: string }>(endpoints.auth.forgotPassword, {
        method: 'POST',
        body: JSON.stringify(request),
        skipAuthRefresh: true,
        suppressAuthExpiredEvent: true,
      }),
    resetPassword: (request: ResetPasswordRequest) =>
      httpClient<{ message: string }>(endpoints.auth.resetPassword, {
        method: 'POST',
        body: JSON.stringify(request),
        skipAuthRefresh: true,
        suppressAuthExpiredEvent: true,
      }),
    logout: async () => {
      await httpClient<unknown>(endpoints.auth.logout, {
        method: 'POST',
        skipAuthRefresh: true,
        suppressAuthExpiredEvent: true,
        body: JSON.stringify({}),
      })
    },
    logoutAll: async () => {
      await httpClient<unknown>(endpoints.auth.logoutAll, {
        method: 'POST',
      })
    },
  },

  profile: {
    get: () =>
      safe(async () => {
        const result = await httpClient<unknown>(endpoints.profile.get)
        return mapUserProfile(result.data as AnyRecord)
      }, null as UserProfile | null),
    update: (request: UpdateProfileRequest) => {
      const formData = new FormData()
      formData.set('Name', request.name)
      formData.set('Surname', request.surname)
      formData.set('Email', request.email)
      formData.set('Phone', request.phone)
      appendIfPresent(formData, 'FileId', request.fileId)

      return httpClient<unknown>(endpoints.profile.update, {
        method: 'PUT',
        body: formData,
      })
    },
  },

  notifications: {
    list: () =>
      safe(async () => {
        const result = await httpClient<unknown>(endpoints.notifications.list)
        return asArray<AnyRecord>(result.data).map(mapNotification)
      }, [] as NotificationItem[]),
    unreadCount: async () => {
      const result = await httpClient<unknown>(endpoints.notifications.unreadCount)
      const record = (result.data && typeof result.data === 'object' ? result.data : {}) as AnyRecord
      return num(record.count)
    },
    markAsRead: (notificationId: string) =>
      httpClient<unknown>(endpoints.notifications.markAsRead(notificationId), {
        method: 'POST',
      }),
    markAllAsRead: () =>
      httpClient<unknown>(endpoints.notifications.markAllAsRead, {
        method: 'POST',
      }),
  },

  restaurants: {
    list: (query = '') => safe(() => listRestaurants(query), restaurants),
    page: (query = '') =>
      safe(async () => {
        const result = await httpClient<unknown>(`${endpoints.restaurants.adminList}${query}`)
        return asPaginated(result.data, mapRestaurant)
      }, {
        items: restaurants,
        pageIndex: 1,
        totalPages: 1,
        totalCount: restaurants.length,
        hasPreviousPage: false,
        hasNextPage: false,
      }),
    create: async (request: CreateRestaurantRequest) => {
      const formData = new FormData()
      formData.set('Location', request.location)
      appendIfPresent(formData, 'Latitude', request.latitude)
      appendIfPresent(formData, 'Longitude', request.longitude)
      appendIfPresent(formData, 'PlaceId', request.placeId)
      formData.set('Phone', request.phone)
      formData.set('Email', request.email)
      appendIfPresent(formData, 'RestaurantGroupId', request.restaurantGroupId)
      appendIfPresent(formData, 'RestaurantGroupName', request.restaurantGroupName)
      appendIfPresent(formData, 'RestaurantGroupLegalName', request.restaurantGroupLegalName)
      appendIfPresent(formData, 'BranchName', request.branchName)
      formData.set('DepositAmount', String(request.depositAmount))
      formData.set('CancellationWindowMinutes', String(request.cancellationWindowMinutes))
      formData.set('ServiceFeePercent', String(request.serviceFeePercent))
      formData.set('StaffSettlementPeriod', String(request.staffSettlementPeriod))
      appendIfPresent(formData, 'DefaultWaiterTableLimit', request.defaultWaiterTableLimit)
      request.fileIds?.forEach((fileId) => formData.append('FileIds', String(fileId)))

      const result = await httpClient<unknown>(endpoints.restaurants.create, {
        method: 'POST',
        body: formData,
      })
      return extractCreatedId(result.data)
    },
    adminDetail: (id: string) =>
      safe(async () => {
        const result = await httpClient<unknown>(endpoints.restaurants.adminDetail(id))
        const record = result.data as AnyRecord
        return mapRestaurant((record.restaurant && typeof record.restaurant === 'object' ? record.restaurant : record) as AnyRecord)
      }, getRestaurant(id)),
    update: (restaurantId: string, request: UpdateRestaurantRequest) =>
      httpClient<unknown>(endpoints.restaurants.update(restaurantId), {
        method: 'PUT',
        body: JSON.stringify({
          location: request.location,
          latitude: request.latitude ?? null,
          longitude: request.longitude ?? null,
          placeId: request.placeId ?? null,
          phone: request.phone,
          email: request.email,
          restaurantGroupId: request.restaurantGroupId ? Number(request.restaurantGroupId) : null,
          restaurantGroupName: request.restaurantGroupName,
          restaurantGroupLegalName: request.restaurantGroupLegalName,
          branchName: request.branchName,
          depositAmount: request.depositAmount,
          cancellationWindowMinutes: request.cancellationWindowMinutes,
          serviceFeePercent: request.serviceFeePercent,
          staffSettlementPeriod: request.staffSettlementPeriod,
          defaultWaiterTableLimit: request.defaultWaiterTableLimit,
          fileIds: request.fileIds,
        }),
      }),
    deactivate: (restaurantId: string) =>
      httpClient<unknown>(endpoints.restaurants.deactivate(restaurantId), {
        method: 'PATCH',
      }),
    publicList: (query = '') =>
      safe(async () => {
        const result = await httpClient<unknown>(`${endpoints.restaurants.publicList}${query}`)
        return asArray<AnyRecord>(result.data).map(mapRestaurant)
      }, restaurants.filter((restaurant) => restaurant.isActive && restaurant.hasActiveContract)),
    publicPage: (query = '') =>
      safe(async () => {
        const result = await httpClient<unknown>(`${endpoints.restaurants.publicList}${query}`)
        return asPaginated(result.data, mapRestaurant)
      }, {
        items: restaurants.filter((restaurant) => restaurant.isActive && restaurant.hasActiveContract),
        pageIndex: 1,
        totalPages: 1,
        totalCount: restaurants.filter((restaurant) => restaurant.isActive && restaurant.hasActiveContract).length,
        hasPreviousPage: false,
        hasNextPage: false,
      }),
    detail: (id: string) =>
      safe(async () => {
        const result = await httpClient<unknown>(endpoints.restaurants.publicDetail(id))
        return mapRestaurant(result.data as AnyRecord)
      }, getRestaurant(id)),
    geocode: async (address: string, limit = 5) => {
      const params = new URLSearchParams({ address, limit: String(limit) })
      const result = await httpClient<unknown>(`${endpoints.restaurants.geocode}?${params.toString()}`)
      const payload = result.data
      const records = Array.isArray(payload)
        ? payload
        : payload && typeof payload === 'object' && Array.isArray((payload as AnyRecord).items)
          ? (payload as AnyRecord).items
          : payload
            ? [payload]
            : []

      return asArray<AnyRecord>(records).map(mapGeocodeAddress)
    },
  },

  users: {
    list: () =>
      safe(async () => {
        const result = await httpClient<unknown>(endpoints.users.adminList)
        return asArray<AnyRecord>(result.data).map(mapUserProfile)
      }, [] as UserProfile[]),
    updateRole: async (userId: string, roleId: number) => {
      const result = await httpClient<unknown>(`${endpoints.users.updateRole(userId)}?roleId=${encodeURIComponent(roleId)}`, {
        method: 'PATCH',
      })
      return extractAuthTokens(result.data)
    },
    delete: (userId: string) =>
      httpClient<unknown>(endpoints.users.delete(userId), {
        method: 'DELETE',
      }),
  },

  workflow: {
    actions: (request: { flowCode: string; statusId: number; restaurantId?: string; entityId?: string }) =>
      safe(async () => {
        const params = new URLSearchParams()
        params.set('statusId', String(request.statusId))
        if (request.restaurantId) {
          params.set('restaurantId', request.restaurantId)
        }
        if (request.entityId) {
          params.set('entityId', request.entityId)
        }

        const result = await httpClient<unknown>(`${endpoints.workflow.actions(request.flowCode)}?${params.toString()}`)
        return asArray<AnyRecord>(result.data).map(mapWorkflowAction)
      }, [] as WorkflowAction[]),
  },

  restaurantGroups: {
    list: () =>
      safe(async () => {
        const result = await httpClient<unknown>(endpoints.restaurantGroups.list)
        return asArray<AnyRecord>(result.data).map(mapRestaurantGroup)
      }, [] as RestaurantGroup[]),
    create: (request: CreateRestaurantGroupRequest) =>
      httpClient<unknown>(endpoints.restaurantGroups.create, {
        method: 'POST',
        body: JSON.stringify(request),
      }),
  },

  lookups: {
    roles: () =>
      safe(async () => {
        const result = await httpClient<unknown>(endpoints.lookups.roles)
        return asArray<AnyRecord>(result.data).map(mapLookup)
      }, [] as LookupItem[]),
    itemStatuses: () =>
      safe(async () => {
        const result = await httpClient<unknown>(endpoints.lookups.itemStatuses)
        return asArray<AnyRecord>(result.data).map(mapLookup)
      }, [] as LookupItem[]),
    units: () =>
      safe(async () => {
        const result = await httpClient<unknown>(endpoints.lookups.units)
        return asArray<AnyRecord>(result.data).map(mapLookup)
      }, [
        { id: 1, code: 'kg', name: 'Kilogram' },
        { id: 2, code: 'g', name: 'Qram' },
        { id: 3, code: 'l', name: 'Litr' },
        { id: 4, code: 'ml', name: 'Millilitr' },
        { id: 5, code: 'pcs', name: 'Eded' },
      ] as LookupItem[]),
    inventoryMovementTypes: () =>
      safe(async () => {
        const result = await httpClient<unknown>(endpoints.lookups.inventoryMovementTypes)
        return asArray<AnyRecord>(result.data).map(mapLookup)
      }, [
        { id: 1, code: 'Purchase', name: 'Alış' },
        { id: 2, code: 'ManualIncrease', name: 'Manual artım' },
        { id: 3, code: 'ManualDecrease', name: 'Manual azalma' },
        { id: 4, code: 'OrderConsumption', name: 'Sifariş sərfiyyatı' },
        { id: 5, code: 'Waste', name: 'İtki' },
        { id: 6, code: 'StockReturn', name: 'Stoka qaytarma' },
        { id: 7, code: 'Correction', name: 'Düzəliş' },
      ] as LookupItem[]),
    contractStatuses: () =>
      safe(async () => {
        const result = await httpClient<unknown>(endpoints.lookups.contractStatuses)
        return asArray<AnyRecord>(result.data).map(mapLookup)
      }, [] as LookupItem[]),
    paymentPolicies: () =>
      safe(async () => {
        const result = await httpClient<unknown>(endpoints.lookups.paymentPolicies)
        return asArray<AnyRecord>(result.data).map(mapLookup)
      }, [] as LookupItem[]),
    auditActions: () =>
      safe(async () => {
        const result = await httpClient<unknown>(endpoints.lookups.auditActions)
        return asArray<AnyRecord>(result.data).map(mapLookup)
      }, [] as LookupItem[]),
    outboxStatuses: () =>
      safe(async () => {
        const result = await httpClient<unknown>(endpoints.lookups.outboxStatuses)
        return asArray<AnyRecord>(result.data).map(mapLookup)
      }, [] as LookupItem[]),
    notificationChannels: () =>
      safe(async () => {
        const result = await httpClient<unknown>(endpoints.lookups.notificationChannels)
        return asArray<AnyRecord>(result.data).map(mapLookup)
      }, [] as LookupItem[]),
  },

  files: {
    upload: async (file: File) => {
      const formData = new FormData()
      formData.set('File', file)

      const result = await httpClient<unknown>(endpoints.files.upload, {
        method: 'POST',
        body: formData,
      })
      return mapUploadedFile(result.data as AnyRecord)
    },
    metadata: async (fileId: string) => {
      const result = await httpClient<unknown>(endpoints.files.metadata(fileId))
      return mapUploadedFile(result.data as AnyRecord)
    },
    viewBlob: (fileUrl: string) => fetchProtectedBlob(fileUrl),
    downloadBlob: (fileUrl: string) => fetchProtectedBlob(fileUrl),
    delete: (fileId: string) =>
      httpClient<unknown>(endpoints.files.delete(fileId), {
        method: 'DELETE',
      }),
  },

  inventory: {
    list: (restaurantId: string, params: { search?: string; onlyLowStock?: boolean } = {}) =>
      safe(async () => {
        const suffix = buildInventoryQuery(params)
        const result = await httpClient<unknown>(`${endpoints.inventory.list(restaurantId)}${suffix}`)
        return asPaginated(result.data, (item) => mapInventoryItem(item, restaurantId)).items
      }, [] as InventoryItem[]),
    listPaginated: (restaurantId: string, params: InventoryQuery = {}) =>
      safe(async () => {
        const result = await httpClient<unknown>(`${endpoints.inventory.list(restaurantId)}${buildInventoryQuery(params)}`)
        return asPaginated(result.data, (item) => mapInventoryItem(item, restaurantId))
      }, emptyPaginated<InventoryItem>()),
    detail: (restaurantId: string, inventoryItemId: string) =>
      safe(async () => {
        const result = await httpClient<unknown>(endpoints.inventory.detail(restaurantId, inventoryItemId))
        return mapInventoryItem(result.data as AnyRecord, restaurantId)
      }, null as InventoryItem | null),
    create: (restaurantId: string, request: CreateInventoryItemRequest) =>
      httpClient<unknown>(endpoints.inventory.create(restaurantId), {
        method: 'POST',
        body: JSON.stringify(request),
      }),
    update: (restaurantId: string, inventoryItemId: string, request: UpdateInventoryItemRequest) =>
      httpClient<unknown>(endpoints.inventory.update(restaurantId, inventoryItemId), {
        method: 'PUT',
        body: JSON.stringify(request),
      }),
    activate: (restaurantId: string, inventoryItemId: string) =>
      httpClient<unknown>(endpoints.inventory.activate(restaurantId, inventoryItemId), {
        method: 'PATCH',
      }),
    deactivate: (restaurantId: string, inventoryItemId: string) =>
      httpClient<unknown>(endpoints.inventory.deactivate(restaurantId, inventoryItemId), {
        method: 'PATCH',
      }),
    delete: (restaurantId: string, inventoryItemId: string) =>
      httpClient<unknown>(endpoints.inventory.delete(restaurantId, inventoryItemId), {
        method: 'DELETE',
      }),
    movements: (restaurantId: string, inventoryItemId: string) =>
      safe(async () => {
        const result = await httpClient<unknown>(endpoints.inventory.movements(restaurantId, inventoryItemId))
        return asPaginated(result.data, (movement) => mapInventoryMovement(movement, restaurantId, inventoryItemId)).items
      }, [] as InventoryMovement[]),
    movementsPaginated: (restaurantId: string, inventoryItemId: string, params: InventoryMovementQuery = {}) =>
      safe(async () => {
        const result = await httpClient<unknown>(`${endpoints.inventory.movements(restaurantId, inventoryItemId)}${buildInventoryMovementQuery(params)}`)
        return asPaginated(result.data, (movement) => mapInventoryMovement(movement, restaurantId, inventoryItemId))
      }, emptyPaginated<InventoryMovement>()),
    createMovement: (restaurantId: string, inventoryItemId: string, request: CreateInventoryMovementRequest) =>
      httpClient<unknown>(endpoints.inventory.movements(restaurantId, inventoryItemId), {
        method: 'POST',
        body: JSON.stringify(request),
      }),
  },

  recipes: {
    list: (restaurantId: string, itemId: string) =>
      safe(async () => {
        const result = await httpClient<unknown>(endpoints.recipes.list(restaurantId, itemId))
        return asArray<AnyRecord>(result.data).map((recipe) => mapRecipe(recipe, restaurantId, itemId))
      }, [] as Recipe[]),
    create: (restaurantId: string, itemId: string, request: CreateRecipeRequest) =>
      httpClient<unknown>(endpoints.recipes.create(restaurantId, itemId), {
        method: 'POST',
        body: JSON.stringify({
          inventoryItemId: Number(request.inventoryItemId),
          quantity: request.quantity,
          unitId: request.unitId,
        }),
      }),
    update: (restaurantId: string, itemId: string, recipeId: string, request: UpdateRecipeRequest) =>
      httpClient<unknown>(endpoints.recipes.update(restaurantId, itemId, recipeId), {
        method: 'PUT',
        body: JSON.stringify({
          inventoryItemId: Number(request.inventoryItemId),
          quantity: request.quantity,
          unitId: request.unitId,
          isActive: request.isActive,
        }),
      }),
    activate: (restaurantId: string, itemId: string, recipeId: string) =>
      httpClient<unknown>(endpoints.recipes.activate(restaurantId, itemId, recipeId), {
        method: 'PATCH',
      }),
    deactivate: (restaurantId: string, itemId: string, recipeId: string) =>
      httpClient<unknown>(endpoints.recipes.deactivate(restaurantId, itemId, recipeId), {
        method: 'PATCH',
      }),
    delete: (restaurantId: string, itemId: string, recipeId: string) =>
      httpClient<unknown>(endpoints.recipes.delete(restaurantId, itemId, recipeId), {
        method: 'DELETE',
      }),
  },

  contracts: {
    list: (restaurantId: string) =>
      safe(async () => {
        const result = await httpClient<unknown>(endpoints.contracts.list(restaurantId))
        return asArray<AnyRecord>(result.data).map((contract) => mapContract(contract, restaurantId))
      }, contracts.filter((contract) => contract.restaurantId === restaurantId)),
    records: (query: ContractRecordQuery = {}) =>
      safe(() => fetchContractRecords(query), contracts.map((contract) => ({ contract, restaurantName: contract.restaurantId }))),
    get: (contractId: string) =>
      safe(async () => {
        const records = await fetchContractRecords()
        return records.find((entry) => entry.contract.id === contractId) ?? null
      }, null),
    listAll: () =>
      safe(async () => {
        const records = await fetchContractRecords()
        return records.map((entry) => contractRow(entry.contract, entry.restaurantName))
      }, getAdminRows('contracts')),
    create: async (restaurantId: string, request: CreateContractRequest) => {
      const result = await httpClient<unknown>(endpoints.contracts.create(restaurantId), {
        method: 'POST',
        body: JSON.stringify(request),
      })
      return extractCreatedId(result.data)
    },
    update: (restaurantId: string, contractId: string, request: UpdateContractRequest) =>
      httpClient<unknown>(endpoints.contracts.update(restaurantId, contractId), {
        method: 'PUT',
        body: JSON.stringify(request),
      }),
    active: (restaurantId: string) =>
      safe(async () => {
        const result = await httpClient<unknown>(endpoints.contracts.active(restaurantId))
        return mapContract(result.data as AnyRecord, restaurantId)
      }, null as RestaurantContract | null),
    actions: (restaurantId: string, contractId: string) =>
      safe(async () => {
        const result = await httpClient<unknown>(endpoints.contracts.actions(restaurantId, contractId))
        return asArray<AnyRecord>(result.data).map(mapWorkflowAction)
      }, [] as WorkflowAction[]),
    executeAction: ({ action, body }: WorkflowActionRequest) =>
      httpClient<unknown>(normalizeWorkflowActionEndpoint(action.endpoint), {
        method: action.httpMethod || 'POST',
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      }),
    sendForSignature: (restaurantId: string, contractId: string) =>
      httpClient<unknown>(endpoints.contracts.sendForSignature(restaurantId, contractId), {
        method: 'POST',
      }),
    approve: (restaurantId: string, contractId: string, request: ApproveContractRequest) =>
      httpClient<unknown>(endpoints.contracts.approve(restaurantId, contractId), {
        method: 'POST',
        body: JSON.stringify({
          restaurantId: Number(restaurantId),
          contractId: Number(contractId),
          hasAcceptedContractTerms: request.hasAcceptedContractTerms,
          acceptanceText: request.acceptanceText,
        }),
      }),
    activate: (restaurantId: string, contractId: string) =>
      httpClient<unknown>(endpoints.contracts.activate(restaurantId, contractId), {
        method: 'POST',
      }),
    terminate: (restaurantId: string, contractId: string) =>
      httpClient<unknown>(endpoints.contracts.terminate(restaurantId, contractId), {
        method: 'POST',
      }),
    hasActiveContract: (restaurantId: string) =>
      contracts.some((contract) => contract.restaurantId === restaurantId && contract.status === 'Active'),
  },

  tables: {
    list: (restaurantId: string) =>
      safe(async () => {
        const result = await httpClient<unknown>(endpoints.tables.list(restaurantId))
        return asArray<AnyRecord>(result.data).map((table) => mapTable(table, restaurantId))
      }, tables.filter((table) => table.restaurantId === restaurantId)),
    listPublic: (restaurantId: string) =>
      safe(async () => {
        const result = await httpClient<unknown>(endpoints.publicRestaurant.tables(restaurantId))
        return asArray<AnyRecord>(result.data).map((table) => mapTable(table, restaurantId))
      }, tables.filter((table) => table.restaurantId === restaurantId && table.isPublic)),
    listAvailable: async (restaurantId: string, guestCount: number) => {
      const tableList = await ecafeApi.tables.listPublic(restaurantId)
      return tableList.filter((table) => table.capacity >= guestCount)
    },
    create: (restaurantId: string, request: CreateTableRequest) => {
      const formData = new FormData()
      formData.set('TableNo', request.tableNo)
      formData.set('Name', request.name)
      formData.set('Capacity', String(request.capacity))

      return httpClient<unknown>(endpoints.tables.create(restaurantId), {
        method: 'POST',
        body: formData,
      })
    },
    update: (restaurantId: string, tableId: string, request: UpdateTableRequest) =>
      httpClient<unknown>(endpoints.tables.update(restaurantId, tableId), {
        method: 'PUT',
        body: JSON.stringify({
          tableNo: Number(request.tableNo),
          name: request.name,
          capacity: request.capacity,
          isActive: request.isActive,
        }),
      }),
    copy: (restaurantId: string, tableId: string, request: CopyTableRequest) =>
      httpClient<unknown>(endpoints.tables.copy(restaurantId, tableId), {
        method: 'POST',
        body: JSON.stringify({
          tableNo: request.tableNo ? Number(request.tableNo) : null,
          name: request.name?.trim() || null,
          copyCount: request.copyCount ? Number(request.copyCount) : 1,
          copies: request.copies?.map((copy) => ({
            tableNo: copy.tableNo ? Number(copy.tableNo) : null,
            name: copy.name?.trim() || null,
          })) ?? [],
        }),
      }),
    activate: (restaurantId: string, tableId: string) =>
      httpClient<unknown>(endpoints.tables.activate(restaurantId, tableId), {
        method: 'PATCH',
      }),
    deactivate: (restaurantId: string, tableId: string) =>
      httpClient<unknown>(endpoints.tables.deactivate(restaurantId, tableId), {
        method: 'PATCH',
      }),
    delete: (restaurantId: string, tableId: string) =>
      httpClient<unknown>(endpoints.tables.delete(restaurantId, tableId), {
        method: 'DELETE',
      }),
  },

  staff: {
    byRestaurant: (restaurantId: string) =>
      safe(async () => {
        const result = await httpClient<unknown>(endpoints.staff.list(restaurantId))
        return asArray<AnyRecord>(result.data).map((member) => mapStaff(member, restaurantId))
      }, staff.filter((member) => member.restaurantId === restaurantId)),
    detail: (restaurantId: string, staffId: string) =>
      safe(async () => {
        const result = await httpClient<unknown>(endpoints.staff.detail(restaurantId, staffId))
        return mapStaff(result.data as AnyRecord, restaurantId)
      }, staff.find((member) => member.restaurantId === restaurantId && member.id === staffId) ?? null),
    waiters: (restaurantId: string) =>
      safe(async () => {
        const result = await httpClient<unknown>(endpoints.publicRestaurant.staff(restaurantId))
        return asArray<AnyRecord>(result.data)
          .map((member) => mapStaff(member, restaurantId))
          .filter((member) => member.role === 'Waiter' && member.status !== 'Inactive')
      }, staff.filter((member) => member.restaurantId === restaurantId && member.role === 'Waiter' && member.status !== 'Inactive')),
    list: () => staff,
    create: (request: CreateStaffRequest) => {
      const formData = new FormData()
      formData.set('Name', request.name)
      formData.set('Surname', request.surname)
      formData.set('Email', request.email)
      formData.set('Phone', request.phone)
      formData.set('IsActive', String(request.isActive))
      formData.set('RestaurantId', request.restaurantId)
      formData.set('RoleId', String(request.roleId))
      appendIfPresent(formData, 'FileId', request.fileId)
      appendIfPresent(formData, 'ServiceFeePercent', request.serviceFeePercent)
      appendIfPresent(formData, 'MaxActiveTableCount', request.maxActiveTableCount)

      return httpClient<unknown>(endpoints.users.create, {
        method: 'POST',
        body: formData,
      })
    },
    update: (restaurantId: string, staffId: string, request: UpdateStaffRequest) => {
      const formData = new FormData()
      formData.set('Name', request.name)
      formData.set('Surname', request.surname)
      formData.set('Email', request.email)
      formData.set('Phone', request.phone)
      formData.set('IsActive', String(request.isActive))
      appendIfPresent(formData, 'FileId', request.fileId)
      appendIfPresent(formData, 'ServiceFeePercent', request.serviceFeePercent)
      appendIfPresent(formData, 'MaxActiveTableCount', request.maxActiveTableCount)

      return httpClient<unknown>(endpoints.staff.update(restaurantId, staffId), {
        method: 'PUT',
        body: formData,
      })
    },
    deactivate: (restaurantId: string, staffId: string) =>
      httpClient<unknown>(endpoints.staff.deactivate(restaurantId, staffId), {
        method: 'PATCH',
      }),
    activate: (restaurantId: string, staffId: string) =>
      httpClient<unknown>(endpoints.staff.activate(restaurantId, staffId), {
        method: 'PATCH',
      }),
    delete: (staffId: string) =>
      httpClient<unknown>(endpoints.users.delete(staffId), {
        method: 'DELETE',
      }),
  },

  menu: {
    publicMenu: (restaurantId: string) => safe(() => fetchPublicMenu(restaurantId), fallbackPublicMenu(restaurantId)),
    publicCategories: (restaurantId: string) =>
      safe(async () => {
        const menu = await fetchPublicMenu(restaurantId)
        return menu.categories
      }, fallbackPublicMenu(restaurantId).categories),
    categories: (restaurantId: string) =>
      safe(() => emptyListOnCategoryEmpty(async () => {
        const result = await httpClient<unknown>(endpoints.menu.categories(restaurantId))
        return asArray<AnyRecord>(result.data).map((category) => mapCategory(category, restaurantId))
      }), menuCategories.filter((category) => category.restaurantId === restaurantId && category.isActive)),
    items: (restaurantId: string) =>
      safe(async () => {
        const menu = await fetchPublicMenu(restaurantId)
        return menu.items
      }, menuItems.filter((item) => item.restaurantId === restaurantId && item.isActive)),
    adminItems: (restaurantId: string) =>
      safe(async () => {
        const query = `?restaurantId=${encodeURIComponent(restaurantId)}`
        const result = await httpClient<unknown>(`${endpoints.menu.items}${query}`)
        return asPaginated(result.data, (item) => mapMenuItem(item, restaurantId)).items
      }, menuItems.filter((item) => item.restaurantId === restaurantId)),
    createCategory: (restaurantId: string, request: CreateCategoryRequest) => {
      const formData = new FormData()
      formData.set('Name', request.name)
      appendIfPresent(formData, 'SortOrder', request.sortOrder)

      return httpClient<unknown>(endpoints.menu.createCategory(restaurantId), {
        method: 'POST',
        body: formData,
      })
    },
    updateCategory: async (restaurantId: string, categoryId: string, request: UpdateCategoryRequest) => {
      const result = await httpClient<unknown>(endpoints.menu.updateCategory(restaurantId, categoryId), {
        method: 'PUT',
        body: JSON.stringify({
          name: request.name,
          sortOrder: request.sortOrder,
          isActive: request.isActive,
        }),
      })

      return mapCategory(result.data as AnyRecord, restaurantId)
    },
    activateCategory: async (restaurantId: string, categoryId: string) => {
      const result = await httpClient<unknown>(endpoints.menu.activateCategory(restaurantId, categoryId), {
        method: 'PATCH',
      })

      return mapCategory(result.data as AnyRecord, restaurantId)
    },
    deactivateCategory: async (restaurantId: string, categoryId: string) => {
      const result = await httpClient<unknown>(endpoints.menu.deactivateCategory(restaurantId, categoryId), {
        method: 'PATCH',
      })

      return mapCategory(result.data as AnyRecord, restaurantId)
    },
    deleteCategory: async (restaurantId: string, categoryId: string) => {
      const result = await httpClient<unknown>(endpoints.menu.deleteCategory(restaurantId, categoryId), {
        method: 'DELETE',
      })

      return mapCategory(result.data as AnyRecord, restaurantId)
    },
    createItem: (restaurantId: string, request: CreateMenuItemRequest) => {
      const formData = new FormData()
      formData.set('CategoryId', request.categoryId)
      formData.set('StatusId', String(request.statusId))
      formData.set('Name', request.name)
      formData.set('Description', request.description)
      formData.set('BasePrice', String(request.basePrice))
      formData.set('IsAvailable', String(request.isAvailable))
      appendIfPresent(formData, 'UnavailableReason', request.unavailableReason)
      appendIfPresent(formData, 'FileId', request.fileId)

      return httpClient<unknown>(endpoints.menu.createItem(restaurantId), {
        method: 'POST',
        body: formData,
      })
    },
  },

  reservations: {
    list: () => reservations,
  },
  orders: {
    list: () => orders,
  },
  payments: {
    list: () => payments,
  },
  settlements: {
    list: () => settlements,
  },

  admin: {
    rows: async (key: AdminModuleKey): Promise<AdminRow[]> => {
      if (key === 'restaurants') {
        const restaurantList = await ecafeApi.restaurants.list()
        return restaurantList.map(restaurantRow)
      }

      if (key === 'contracts') {
        return ecafeApi.contracts.listAll()
      }

      if (key === 'tables') {
        const restaurantList = await ecafeApi.restaurants.list()
        const tableGroups = await Promise.all(restaurantList.map((restaurant) => ecafeApi.tables.list(restaurant.id)))
        return tableGroups.flat().map(tableRow)
      }

      if (key === 'staff') {
        const restaurantList = await ecafeApi.restaurants.list()
        const staffGroups = await Promise.all(restaurantList.map((restaurant) => ecafeApi.staff.byRestaurant(restaurant.id)))
        return staffGroups.flat().map(staffRow)
      }

      if (key === 'categories') {
        const restaurantList = await ecafeApi.restaurants.list()
        const categoryGroups = await Promise.all(restaurantList.map((restaurant) => ecafeApi.menu.categories(restaurant.id)))
        return categoryGroups.flat().map(categoryRow)
      }

      if (key === 'menu') {
        const restaurantList = await ecafeApi.restaurants.list()
        const itemGroups = await Promise.all(restaurantList.map((restaurant) => ecafeApi.menu.adminItems(restaurant.id)))
        return itemGroups.flat().map(menuRow)
      }

      if (key === 'restaurant-groups') {
        const groups = await ecafeApi.restaurantGroups.list()
        return groups.map((group) => ({
          id: group.id,
          title: group.name,
          subtitle: group.legalName || '-',
          status: group.isActive ? 'Aktiv' : 'Deaktiv',
          tone: group.isActive ? 'success' : 'neutral',
          meta: group.legalName || '-',
          value: '-',
        }))
      }

      if (key === 'audit-logs') {
        return []
      }

      return getAdminRows(key)
    },
  },

  auditLogs: {
    page: (restaurantId: string, query: AuditLogQuery = {}) =>
      safe(async () => {
        const result = await httpClient<unknown>(`${endpoints.auditLogs.list(restaurantId)}${buildAuditLogQuery(query)}`)
        return asPaginated(result.data, mapAuditLog)
      }, {
        items: [],
        pageIndex: 1,
        totalPages: 1,
        totalCount: 0,
        hasPreviousPage: false,
        hasNextPage: false,
      } as PaginatedResponse<AuditLogEntry>),
    list: async (restaurantId: string, query: AuditLogQuery = {}) => {
      const page = await ecafeApi.auditLogs.page(restaurantId, query)
      return page.items
    },
  },

  outbox: {
    page: (query: OutboxMessageQuery = {}) =>
      safe(async () => {
        const result = await httpClient<unknown>(`${endpoints.outbox.list}${buildOutboxQuery(query)}`)
        return asPaginated(result.data, mapOutboxMessage)
      }, {
        items: [],
        pageIndex: 1,
        totalPages: 1,
        totalCount: 0,
        hasPreviousPage: false,
        hasNextPage: false,
      } as PaginatedResponse<OutboxMessage>),
    detail: async (messageId: string) => {
      const result = await httpClient<unknown>(endpoints.outbox.detail(messageId))
      return mapOutboxMessage(result.data as AnyRecord)
    },
    retry: async (messageId: string) => {
      const result = await httpClient<unknown>(endpoints.outbox.retry(messageId), {
        method: 'POST',
      })
      return mapOutboxMessage(result.data as AnyRecord)
    },
  },
}
