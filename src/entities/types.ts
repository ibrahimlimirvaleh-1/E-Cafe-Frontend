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

export type ContractStatus = 'Draft' | 'PendingSignature' | 'OwnerApproved' | 'Active' | 'Expired' | 'Terminated'

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
  monthlyFee: number
  commissionPercent: number
  settlementPeriod: string
  paymentPolicy: 'OnlineOnly'
  paymentPolicyId?: number
  fileName: string
  fileId?: number
  fileUrl?: string
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
  capacity: number
  status: 'Available' | 'Reserved' | 'Occupied' | 'Hidden'
  isPublic: boolean
  image?: string
}

export type StaffMember = {
  id: string
  restaurantId: string
  name: string
  role: Role
  phone: string
  status: 'Active' | 'OnBreak' | 'Inactive'
  serviceFeePercent?: number
  currentEarning: number
  avatar: string
}

export type MenuCategory = {
  id: string
  restaurantId: string
  name: string
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
  entityName: string
  entityId: string
  actorName: string
  createdAt: string
  description: string
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
}
