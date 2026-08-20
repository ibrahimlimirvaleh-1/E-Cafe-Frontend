import type { LucideIcon } from 'lucide-react'

export type Role = 'PlatformAdmin' | 'Owner' | 'Manager' | 'Waiter' | 'Kitchen' | 'Customer'

export type ReservationStatus =
  | 'PendingDeposit'
  | 'Reserved'
  | 'Seated'
  | 'Completed'
  | 'Cancelled'
  | 'Expired'
  | 'NoShow'

export type OrderStatus = 'Created' | 'Accepted' | 'Preparing' | 'Ready' | 'Served' | 'Closed' | 'Cancelled'

export type PaymentStatus = 'Pending' | 'Paid' | 'Failed' | 'Refunded' | 'RefundFailed'

export type ContractStatus = 'Draft' | 'PendingSignature' | 'OwnerApproved' | 'Scheduled' | 'Active' | 'Expired' | 'Terminated'

export type SettlementStatus = 'Open' | 'Payable' | 'PaidByRestaurant' | 'Disputed'

export type StatusTone = 'success' | 'warning' | 'info' | 'danger' | 'neutral'

export type Restaurant = {
  id: string
  name: string
  address: string
  phone: string
  email?: string
  rating: number
  cuisine: string
  branchName?: string
  restaurantGroupId?: string
  restaurantGroupName?: string
  cancellationWindowMinutes?: number
  image: string
  isActive: boolean
  hasActiveContract: boolean
  depositAmount: number
  defaultWaiterTableLimit?: number
  defaultServiceFeePercent: number
  staffPayoutFrequency: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'manual'
}

export type RestaurantContract = {
  id: string
  restaurantId: string
  contractNumber: string
  status: ContractStatus
  statusId?: number
  statusName?: string
  startDate: string
  endDate: string
  amount: number
  monthlyFee: number
  commissionPercent: number
  settlementPeriod: string
  expiryReminderDaysBefore: number
  expiryReminderAt?: string
  expiryReminderSentAt?: string
  paymentPolicy: 'OnlineOnly'
  paymentPolicyId?: number
  fileName: string
  fileId?: number
  fileUrl?: string
  fileDownloadUrl?: string
  signedAt?: string
  signedByUserId?: number
  signedByUserName?: string
  availableActions?: WorkflowAction[]
}

export type WorkflowAction = {
  code: 'sendForSignature' | 'approve' | 'activate' | 'terminate' | string
  label: string
  httpMethod: string
  endpoint: string
  requiresConfirmation: boolean
  sortOrder: number
}

export type Table = {
  id: string
  restaurantId: string
  number: string
  name?: string
  capacity: number
  status: 'Available' | 'Reserved' | 'Occupied' | 'Hidden'
  isActive: boolean
  isPublic: boolean
  image?: string
}

export type StaffMember = {
  id: string
  restaurantId: string
  name: string
  surname?: string
  email?: string
  role: Role
  roleId?: number
  phone: string
  status: 'Active' | 'OnBreak' | 'Inactive'
  serviceFeePercent?: number
  maxActiveTableCount?: number
  effectiveMaxActiveTableCount?: number
  activeTableSessionCount?: number
  canAcceptMoreTables?: boolean
  currentEarning: number
  avatar: string
}

export type MenuCategory = {
  id: string
  restaurantId: string
  name: string
  sortOrder: number
  isActive: boolean
}

export type MenuItem = {
  id: string
  restaurantId: string
  categoryId: string
  categoryName?: string
  name: string
  description: string
  price: number
  image: string
  isActive: boolean
  statusName?: string
  salesCount?: number
}

export type InventoryItem = {
  id: string
  restaurantId: string
  name: string
  unitId: number
  unitName: string
  unitCode: string
  quantityOnHand: number
  lowStockThreshold: number
  isLowStock: boolean
  isActive: boolean
}

export type InventoryMovement = {
  id: string
  restaurantId: string
  inventoryItemId: string
  quantityChange: number
  unitId: number
  unitName: string
  movementTypeId: number
  movementType: string
  movementTypeCode: string
  reason: string
  quantityAfterMovement: number
  createdAt: string
}

export type Recipe = {
  id: string
  restaurantId: string
  itemId: string
  itemName: string
  inventoryItemId: string
  inventoryItemName: string
  quantity: number
  unitId: number
  unitName: string
  unitCode: string
  isActive: boolean
}

export type LookupItem = {
  id: number
  code: string
  name: string
}

export type RestaurantGroup = {
  id: string
  name: string
  legalName: string
  isActive: boolean
}

export type UserProfile = {
  id: string
  name: string
  surname: string
  email: string
  phone: string
  isActive: boolean
  rating: number
  roleId: number
  role: string
  restaurantId?: string
  restaurantName?: string
  fileUrl?: string
}

export type AuditLogEntry = {
  id: string
  action: string
  actionDisplayName?: string
  entityName: string
  entityId: string
  entityDisplayName?: string
  actorUserId?: string
  actorName: string
  actorRoleId?: number
  actorRoleName?: string
  actorEmail?: string
  traceId?: string
  ipAddress?: string
  userAgent?: string
  occurredAt: string
  createdAt: string
  description: string
  details: AuditLogDetail[]
}

export type AuditLogDetail = {
  label: string
  value?: string
  oldValue?: string
  newValue?: string
}

export type NotificationItem = {
  id: string
  restaurantId?: string
  title: string
  message: string
  typeId: number
  typeName: string
  channelId: number
  statusId: number
  isRead: boolean
  readAt?: string
  payloadJson?: string
  relatedEntityType?: string
  relatedEntityId?: string
  createdAt: string
}

export type OutboxMessage = {
  id: string
  eventType: string
  aggregateType: string
  aggregateId: number
  channelId: number
  channel: string
  statusId: number
  status: string
  recipient: string
  recipientName: string
  subject: string
  retryCount: number
  maxRetryCount: number
  occurredAt: string
  processedAt?: string
  lockedUntil?: string
  nextRetryAt?: string
  lastError?: string
  relatedEntityType?: string
  relatedEntityId?: number
}

export type Reservation = {
  id: string
  restaurantId: string
  customerName: string
  tableId: string
  waiterId: string
  guestCount: number
  dateTime: string
  status: ReservationStatus
  depositStatus: PaymentStatus
  selectedMenuItemIds: string[]
}

export type Order = {
  id: string
  restaurantId: string
  reservationId?: string
  tableId: string
  waiterId: string
  source: 'WaiterCreated' | 'CustomerCreated'
  status: OrderStatus
  paymentStatus: PaymentStatus
  total: number
  itemNames: string[]
}

export type Payment = {
  id: string
  restaurantId: string
  target: 'ReservationDeposit' | 'OrderFinal'
  status: PaymentStatus
  amount: number
  provider: 'Payriff'
  correlationKey: string
}

export type StaffSettlement = {
  id: string
  staffId: string
  period: string
  status: SettlementStatus
  payableAmount: number
}

export type AdminModuleKey =
  | 'restaurants'
  | 'restaurant-groups'
  | 'contracts'
  | 'reservations'
  | 'orders'
  | 'payments'
  | 'staff'
  | 'tables'
  | 'categories'
  | 'menu'
  | 'inventory'
  | 'inventory-movements'
  | 'recipes'
  | 'audit-logs'

export type AdminModule = {
  key: AdminModuleKey
  title: string
  singular: string
  route: string
  icon: LucideIcon
  createLabel?: string
  dangerLabel?: string
  description: string
  columns: string[]
}

export type AdminRow = {
  id: string
  title: string
  subtitle: string
  status: string
  tone: StatusTone
  meta: string
  value: string
  image?: string
  canEdit?: boolean
}
