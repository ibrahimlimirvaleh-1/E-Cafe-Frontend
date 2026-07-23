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
} from '../../entities/types'
import type { AnyRecord } from './responseUtils'
import { bool, num, str } from './responseUtils'

function imageUrl(record: AnyRecord, fallback: string) {
  return str(record.fileUrl || record.imageUrl || record.image, fallback)
}

export function mapRestaurant(record: AnyRecord): Restaurant {
  return {
    id: str(record.id || record.restaurantId),
    name: str(record.name),
    address: str(record.address || record.location),
    phone: str(record.phone),
    rating: num(record.rating, 4.8),
    cuisine: str(record.cuisine || record.cuisineName, 'Restoran'),
    image: imageUrl(record, 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80'),
    isActive: bool(record.isActive, true),
    hasActiveContract: bool(record.hasActiveContract),
    depositAmount: num(record.depositAmount),
    defaultServiceFeePercent: num(record.defaultServiceFeePercent || record.serviceFeePercent),
    staffPayoutFrequency: 'weekly',
  }
}

export function mapTable(record: AnyRecord, restaurantId: string): Table {
  return {
    id: str(record.id || record.tableId),
    restaurantId: str(record.restaurantId, restaurantId),
    number: str(record.number || record.name || record.tableNumber),
    capacity: num(record.capacity || record.seatCount, 2),
    status: str(record.status || record.statusName, 'Available') as Table['status'],
    isPublic: bool(record.isPublic, true),
    image: str(record.imageUrl || record.fileUrl || record.image),
  }
}

export function mapStaff(record: AnyRecord, restaurantId: string): StaffMember {
  return {
    id: str(record.id || record.userId),
    restaurantId: str(record.restaurantId, restaurantId),
    name: `${str(record.name)} ${str(record.surname)}`.trim() || str(record.fullName),
    role: str(record.roleName || record.role, 'Waiter') as StaffMember['role'],
    phone: str(record.phone),
    status: bool(record.isActive, true) ? 'Active' : 'Inactive',
    serviceFeePercent: record.serviceFeePercent == null ? undefined : num(record.serviceFeePercent),
    currentEarning: num(record.currentEarning),
    avatar: imageUrl(record, 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=300&q=80'),
  }
}

export function mapCategory(record: AnyRecord, restaurantId: string): MenuCategory {
  return {
    id: str(record.id || record.categoryId),
    restaurantId: str(record.restaurantId, restaurantId),
    name: str(record.name),
    isActive: bool(record.isActive, true),
  }
}

export function mapMenuItem(record: AnyRecord, restaurantId: string): MenuItem {
  return {
    id: str(record.id || record.itemId),
    restaurantId: str(record.restaurantId, restaurantId),
    categoryId: str(record.categoryId),
    name: str(record.name),
    description: str(record.description),
    price: num(record.price),
    image: imageUrl(record, 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80'),
    isActive: bool(record.isActive, true),
  }
}

export function mapContractStatus(value: unknown): ContractStatus {
  const status = str(value)
  const statusMap: Record<string, ContractStatus> = {
    Layihə: 'Draft',
    'Owner təsdiqlədi': 'OwnerApproved',
    'İmzaya göndərildi': 'PendingSignature',
    Aktiv: 'Active',
    'Ləğv edildi': 'Terminated',
  }

  return statusMap[status] ?? ((status || 'Draft') as ContractStatus)
}

export function mapContract(record: AnyRecord, restaurantId: string): RestaurantContract {
  return {
    id: str(record.id || record.contractId),
    restaurantId: str(record.restaurantId, restaurantId),
    contractNumber: str(record.contractNumber),
    status: mapContractStatus(record.status || record.statusName),
    startDate: str(record.startDate),
    endDate: str(record.endDate),
    monthlyFee: num(record.monthlyFee),
    commissionPercent: num(record.commissionPercent),
    settlementPeriod: str(record.staffSettlementPeriod || record.settlementPeriod),
    paymentPolicy: 'OnlineOnly',
    fileName: str(record.fileName || record.fileUrl || record.contractFileUrl),
  }
}

function tone(status: string): StatusTone {
  if (['Active', 'Aktiv', 'OwnerApproved', 'Ready', 'Paid', 'Available'].includes(status)) {
    return 'success'
  }

  if (['Draft', 'PendingSignature', 'Reserved', 'Preparing', 'Pending'].includes(status)) {
    return 'warning'
  }

  if (['Terminated', 'Inactive', 'Deaktiv', 'Failed', 'Cancelled'].includes(status)) {
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
    status: contract.status,
    tone: tone(contract.status),
    meta: `${contract.startDate || '-'} - ${contract.endDate || '-'}`,
    value: `Komissiya ${contract.commissionPercent}%`,
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
    status: member.status,
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
    meta: item.categoryId || '-',
    value: `${item.price.toFixed(2)} ₼`,
  }
}
