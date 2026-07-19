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

export type ContractStatus = 'Draft' | 'PendingSignature' | 'Active' | 'Expired' | 'Terminated'

export type SettlementStatus = 'Open' | 'Payable' | 'PaidByRestaurant' | 'Disputed'

export type StatusTone = 'success' | 'warning' | 'info' | 'danger' | 'neutral'

export type Restaurant = {
  id: string
  name: string
  address: string
  phone: string
  rating: number
  cuisine: string
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
  startDate: string
  endDate: string
  monthlyFee: number
  commissionPercent: number
  settlementPeriod: string
  paymentPolicy: 'OnlineOnly'
  fileName: string
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
  name: string
  description: string
  price: number
  image: string
  isActive: boolean
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
  | 'contracts'
  | 'reservations'
  | 'orders'
  | 'payments'
  | 'staff'
  | 'tables'
  | 'categories'
  | 'menu'

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
