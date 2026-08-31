import type {
  AdminRow,
  ContractStatus,
  MenuCategory,
  MenuItem,
  Restaurant,
  RestaurantContract,
  StaffMember,
  StatusTone,
  Table,
  WorkflowAction,
} from '../../entities/types'
import type { AnyRecord } from './responseUtils'
import { getApiOrigin } from './httpClient'
import { bool, num, str } from './responseUtils'

function resolvePublicApiAssetUrl(value: string) {
  if (!value) {
    return value
  }

  const apiPath = extractApiPath(value)
  if (!apiPath) {
    return value
  }

  return `${getApiOrigin()}${apiPath}`
}

function extractApiPath(value: string) {
  if (value.startsWith('/api/')) {
    return value
  }

  if (!/^https?:\/\//i.test(value)) {
    return ''
  }

  try {
    const url = new URL(value)
    return url.pathname.startsWith('/api/') ? `${url.pathname}${url.search}` : ''
  } catch {
    return ''
  }
}

function imageUrl(record: AnyRecord, fallback: string) {
  const urls = Array.isArray(record.imageUrls) ? record.imageUrls : []
  return resolvePublicApiAssetUrl(str(record.fileUrl || record.imageUrl || record.image || urls[0], fallback))
}

function nullableNum(value: unknown) {
  if (value == null || value === '') {
    return null
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function mapRestaurant(record: AnyRecord): Restaurant {
  const restaurant = (record.restaurant && typeof record.restaurant === 'object' ? record.restaurant : record) as AnyRecord

  return {
    id: str(restaurant.id || restaurant.restaurantId),
    name: str(restaurant.name),
    address: str(restaurant.address || restaurant.location),
    latitude: nullableNum(restaurant.latitude),
    longitude: nullableNum(restaurant.longitude),
    placeId: str(restaurant.placeId || restaurant.place_id) || null,
    phone: str(restaurant.phone),
    email: str(restaurant.email),
    rating: num(restaurant.rating || restaurant.ratingAverage, 4.8),
    cuisine: str(restaurant.cuisine || restaurant.cuisineName || restaurant.restaurantGroupName, 'Restoran'),
    branchName: str(restaurant.branchName),
    restaurantGroupId: restaurant.restaurantGroupId == null ? undefined : str(restaurant.restaurantGroupId),
    restaurantGroupName: str(restaurant.restaurantGroupName),
    cancellationWindowMinutes: restaurant.cancellationWindowMinutes == null ? undefined : num(restaurant.cancellationWindowMinutes),
    image: imageUrl(restaurant, 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80'),
    isActive: bool(restaurant.isActive, true),
    hasActiveContract: bool(restaurant.hasActiveContract, true),
    depositAmount: num(restaurant.depositAmount),
    defaultWaiterTableLimit: restaurant.defaultWaiterTableLimit == null ? undefined : num(restaurant.defaultWaiterTableLimit),
    defaultServiceFeePercent: num(restaurant.defaultServiceFeePercent || restaurant.serviceFeePercent),
    staffPayoutFrequency: 'weekly',
  }
}

export function mapTable(record: AnyRecord, restaurantId: string): Table {
  const isEmpty = record.isEmpty
  const isActive = bool(record.isActive, true)
  const tableNumber = str(record.tableNo || record.tableNumber || record.number)
  const tableName = str(record.name)

  return {
    id: str(record.id || record.tableId),
    restaurantId: str(record.restaurantId, restaurantId),
    number: tableNumber || tableName,
    name: tableName,
    capacity: num(record.capacity || record.seatCount, 2),
    status: (isActive ? str(record.status || record.statusName || (isEmpty === false ? 'Occupied' : 'Available'), 'Available') : 'Hidden') as Table['status'],
    isActive,
    isPublic: bool(record.isPublic, true),
    image: str(record.imageUrl || record.fileUrl || record.image),
  }
}

function normalizeStaffRole(role: string): StaffMember['role'] {
  const normalized = role.trim().toLowerCase()

  if (normalized.includes('ofisiant') || normalized.includes('waiter')) {
    return 'Waiter'
  }

  if (normalized.includes('mətbəx') || normalized.includes('metbex') || normalized.includes('kitchen')) {
    return 'Kitchen'
  }

  if (normalized.includes('menecer') || normalized.includes('manager')) {
    return 'Manager'
  }

  if (normalized.includes('sahibkar') || normalized.includes('owner')) {
    return 'Owner'
  }

  if (normalized.includes('admin')) {
    return 'PlatformAdmin'
  }

  return 'Waiter'
}

export function mapStaff(record: AnyRecord, restaurantId: string): StaffMember {
  const role = str(record.roleName || record.role, 'Waiter')
  const name = str(record.name)
  const surname = str(record.surname)

  return {
    id: str(record.id || record.userId || record.staffId),
    restaurantId: str(record.restaurantId, restaurantId),
    name: `${name} ${surname}`.trim() || str(record.fullName),
    surname,
    email: str(record.email),
    role: normalizeStaffRole(role),
    roleId: record.roleId == null ? undefined : num(record.roleId),
    phone: str(record.phone || record.email),
    status: bool(record.isActive, true) ? 'Active' : 'Inactive',
    serviceFeePercent: record.serviceFeePercent == null ? undefined : num(record.serviceFeePercent),
    maxActiveTableCount: record.maxActiveTableCount == null ? undefined : num(record.maxActiveTableCount),
    effectiveMaxActiveTableCount: record.effectiveMaxActiveTableCount == null ? undefined : num(record.effectiveMaxActiveTableCount),
    activeTableSessionCount: record.activeTableSessionCount == null ? undefined : num(record.activeTableSessionCount),
    canAcceptMoreTables: record.canAcceptMoreTables == null ? undefined : bool(record.canAcceptMoreTables, true),
    currentEarning: num(record.currentEarning),
    avatar: imageUrl(record, 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=300&q=80'),
  }
}

export function mapCategory(record: AnyRecord, restaurantId: string): MenuCategory {
  return {
    id: str(record.id || record.categoryId),
    restaurantId: str(record.restaurantId, restaurantId),
    name: str(record.name),
    sortOrder: num(record.sortOrder),
    isActive: bool(record.isActive, true),
  }
}

export function mapMenuItem(record: AnyRecord, restaurantId: string): MenuItem {
  return {
    id: str(record.id || record.itemId),
    restaurantId: str(record.restaurantId, restaurantId),
    categoryId: str(record.categoryId),
    categoryName: str(record.categoryName),
    name: str(record.name),
    description: str(record.description),
    price: num(record.price || record.basePrice),
    image: imageUrl(record, 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80'),
    isActive: bool(record.isActive, true),
    statusId: record.statusId == null ? undefined : num(record.statusId),
    statusName: str(record.statusName || record.status),
    salesCount: num(record.salesCount),
  }
}

export function mapContractStatus(value: unknown): ContractStatus {
  const status = str(value)
  const normalized = status.trim().toLowerCase()
  const statusMap: Record<string, ContractStatus> = {
    '6001': 'Draft',
    '6002': 'PendingSignature',
    '6003': 'Active',
    '6004': 'Expired',
    '6005': 'Terminated',
    '6006': 'OwnerApproved',
    '6007': 'Scheduled',
    Layihə: 'Draft',
    Qaralama: 'Draft',
    'Owner təsdiqlədi': 'OwnerApproved',
    'İmzaya göndərildi': 'PendingSignature',
    'Təsdiq gözləyir': 'PendingSignature',
    Aktiv: 'Active',
    'Planlaşdırılıb': 'Scheduled',
    'Ləğv edildi': 'Terminated',
    'Ləğv edilib': 'Terminated',
    Bitdi: 'Expired',
    'Müddəti bitib': 'Expired',
  }

  if (normalized.includes('planla') || normalized.includes('scheduled')) {
    return 'Scheduled'
  }

  return statusMap[status] ?? ((status || 'Draft') as ContractStatus)
}

export function contractStatusLabel(contract: RestaurantContract) {
  const labels: Record<ContractStatus, string> = {
    Draft: 'Qaralama',
    PendingSignature: 'Təsdiq gözləyir',
    OwnerApproved: 'Owner təsdiqlədi',
    Scheduled: 'Planlaşdırılıb',
    Active: 'Aktiv',
    Expired: 'Bitib',
    Terminated: 'Ləğv edilib',
  }

  return contract.statusName || labels[contract.status] || contract.status
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

export function mapContract(record: AnyRecord, restaurantId: string): RestaurantContract {
  return {
    id: str(record.id || record.contractId),
    restaurantId: str(record.restaurantId, restaurantId),
    contractNumber: str(record.contractNumber),
    status: mapContractStatus(record.status || record.statusName || record.statusId),
    statusId: record.statusId == null ? undefined : num(record.statusId),
    statusName: str(record.statusName || record.status),
    startDate: str(record.startDate),
    endDate: str(record.endDate),
    amount: num(record.amount),
    monthlyFee: num(record.monthlyFee),
    commissionPercent: num(record.commissionPercent),
    settlementPeriod: str(record.staffSettlementPeriod || record.settlementPeriod),
    expiryReminderDaysBefore: num(record.expiryReminderDaysBefore, 1),
    expiryReminderAt: str(record.expiryReminderAt),
    expiryReminderSentAt: str(record.expiryReminderSentAt),
    paymentPolicy: 'OnlineOnly',
    paymentPolicyId: record.paymentPolicyId == null ? undefined : num(record.paymentPolicyId),
    fileName: str(record.fileName),
    fileId: record.fileId == null ? undefined : num(record.fileId),
    fileUrl: str(record.fileUrl || record.contractFileUrl),
    fileDownloadUrl: str(record.fileDownloadUrl || record.downloadUrl),
    signedAt: str(record.signedAt),
    signedByUserId: record.signedByUserId == null ? undefined : num(record.signedByUserId),
    signedByUserName: str(record.signedByUserName),
    availableActions: Array.isArray(record.availableActions)
      ? record.availableActions.map((action) => mapWorkflowAction(action as AnyRecord))
      : [],
  }
}

function tone(status: string): StatusTone {
  if (['Active', 'Aktiv', 'OwnerApproved', 'Owner təsdiqlədi', 'Ready', 'Paid', 'Available'].includes(status)) {
    return 'success'
  }

  if (['Draft', 'Qaralama', 'PendingSignature', 'Təsdiq gözləyir', 'Scheduled', 'Planlaşdırılıb', 'Reserved', 'Preparing', 'Pending'].includes(status)) {
    return 'warning'
  }

  if (['Terminated', 'Ləğv edilib', 'Inactive', 'Deaktiv', 'Failed', 'Cancelled'].includes(status)) {
    return 'danger'
  }

  return 'neutral'
}

export function restaurantRow(restaurant: Restaurant): AdminRow {
  return {
    id: restaurant.id,
    title: restaurant.name,
    subtitle: `${restaurant.address} · ${restaurant.phone}`,
    image: restaurant.image,
    status: restaurant.isActive ? 'Aktiv' : 'Deaktiv',
    tone: restaurant.isActive ? 'success' : 'danger',
    meta: restaurant.hasActiveContract ? 'Aktiv müqavilə' : 'Müqavilə yoxdur',
    value: `${restaurant.depositAmount} ₼ depozit`,
  }
}

export function contractRow(contract: RestaurantContract, restaurantName = contract.restaurantId): AdminRow {
  return {
    id: contract.id,
    title: contract.contractNumber || `Müqavilə #${contract.id}`,
    subtitle: restaurantName,
    status: contractStatusLabel(contract),
    tone: tone(contract.status),
    meta: `${contract.startDate || '-'} - ${contract.endDate || '-'}`,
    value: `${contract.amount || 0} AZN`,
    canEdit: contract.status === 'Draft' || contract.status === 'PendingSignature',
  }
}

export function tableRow(table: Table): AdminRow {
  return {
    id: table.id,
    title: table.number,
    subtitle: table.restaurantId,
    image: table.image,
    status: table.status,
    tone: tone(table.status),
    meta: `${table.capacity} nəfər`,
    value: table.isPublic ? 'Görünür' : 'Gizlidir',
  }
}

export function staffRow(member: StaffMember): AdminRow {
  return {
    id: member.id,
    title: member.name,
    subtitle: member.phone,
    image: member.avatar,
    status: member.status === 'Active' ? 'Aktiv' : 'Deaktiv',
    tone: tone(member.status),
    meta: member.role,
    value: member.serviceFeePercent == null ? '-' : `${member.serviceFeePercent}%`,
  }
}

export function categoryRow(category: MenuCategory): AdminRow {
  return {
    id: category.id,
    title: category.name,
    subtitle: category.restaurantId,
    status: category.isActive ? 'Aktiv' : 'Deaktiv',
    tone: category.isActive ? 'success' : 'neutral',
    meta: category.restaurantId,
    value: '-',
  }
}

export function menuRow(item: MenuItem): AdminRow {
  return {
    id: item.id,
    title: item.name,
    subtitle: item.description,
    image: item.image,
    status: item.isActive ? 'Aktiv' : 'Deaktiv',
    tone: item.isActive ? 'success' : 'neutral',
    meta: item.statusName || item.categoryId || '-',
    value: `${item.price.toFixed(2)} ₼`,
  }
}
