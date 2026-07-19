import {
  CalendarDays,
  ClipboardList,
  CreditCard,
  FileText,
  ShoppingBag,
  Store,
  Table2,
  Tags,
  Users,
} from 'lucide-react'
import type {
  AdminModule,
  AdminModuleKey,
  AdminRow,
  MenuCategory,
  MenuItem,
  Order,
  Payment,
  Reservation,
  Restaurant,
  RestaurantContract,
  StaffMember,
  StaffSettlement,
  Table,
} from './types'

export const restaurants: Restaurant[] = [
  {
    id: 'saffron-premium',
    name: 'Saffron Premium Lounge',
    address: 'Nizami küçəsi 42, Bakı',
    phone: '+994 50 220 44 18',
    rating: 4.9,
    cuisine: 'Azərbaycan və Avropa mətbəxi',
    image:
      'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80',
    isActive: true,
    hasActiveContract: true,
    depositAmount: 5,
    defaultServiceFeePercent: 10,
    staffPayoutFrequency: 'weekly',
  },
  {
    id: 'lumina-cafe',
    name: 'Lumina Cafe',
    address: 'Ağ şəhər, Bakı',
    phone: '+994 55 418 20 20',
    rating: 4.7,
    cuisine: 'Brunch, desert və specialty coffee',
    image:
      'https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&w=1200&q=80',
    isActive: true,
    hasActiveContract: false,
    depositAmount: 8,
    defaultServiceFeePercent: 8,
    staffPayoutFrequency: 'manual',
  },
]

export const contracts: RestaurantContract[] = [
  {
    id: 'contract-1001',
    restaurantId: 'saffron-premium',
    contractNumber: 'EC-2026-001',
    status: 'Active',
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    monthlyFee: 59,
    commissionPercent: 2.5,
    settlementPeriod: 'weekly',
    paymentPolicy: 'OnlineOnly',
    fileName: 'saffron-contract.pdf',
  },
  {
    id: 'contract-1002',
    restaurantId: 'lumina-cafe',
    contractNumber: 'EC-2026-002',
    status: 'PendingSignature',
    startDate: '2026-02-01',
    endDate: '2027-01-31',
    monthlyFee: 29,
    commissionPercent: 3,
    settlementPeriod: 'manual',
    paymentPolicy: 'OnlineOnly',
    fileName: 'lumina-contract-draft.pdf',
  },
]

export const tables: Table[] = [
  { id: 'table-101', restaurantId: 'saffron-premium', number: 'T-101', capacity: 2, status: 'Available', isPublic: true },
  { id: 'table-104', restaurantId: 'saffron-premium', number: 'T-104', capacity: 4, status: 'Reserved', isPublic: true },
  { id: 'table-vip-2', restaurantId: 'saffron-premium', number: 'VIP-2', capacity: 8, status: 'Available', isPublic: true },
  { id: 'table-terrace-8', restaurantId: 'saffron-premium', number: 'Terrace-8', capacity: 6, status: 'Occupied', isPublic: false },
]

export const staff: StaffMember[] = [
  { id: 'staff-leyla', restaurantId: 'saffron-premium', name: 'Leyla Məmmədova', role: 'Waiter', phone: '+994 50 777 11 22', status: 'Active', serviceFeePercent: 12, currentEarning: 146 },
  { id: 'staff-ali', restaurantId: 'saffron-premium', name: 'Əli Həsənov', role: 'Waiter', phone: '+994 55 345 88 91', status: 'OnBreak', currentEarning: 92 },
  { id: 'staff-nigar', restaurantId: 'saffron-premium', name: 'Nigar Əliyeva', role: 'Manager', phone: '+994 70 333 44 55', status: 'Active', currentEarning: 0 },
  { id: 'staff-kitchen', restaurantId: 'saffron-premium', name: 'Kitchen Board', role: 'Kitchen', phone: '-', status: 'Active', currentEarning: 0 },
]

export const menuCategories: MenuCategory[] = [
  { id: 'cold-starters', restaurantId: 'saffron-premium', name: 'Soyuq qəlyanaltılar', isActive: true },
  { id: 'main-dishes', restaurantId: 'saffron-premium', name: 'Əsas yeməklər', isActive: true },
  { id: 'drinks', restaurantId: 'saffron-premium', name: 'İçkilər', isActive: true },
  { id: 'desserts', restaurantId: 'saffron-premium', name: 'Şirniyyatlar', isActive: true },
]

export const menuItems: MenuItem[] = [
  {
    id: 'veg-bouquet',
    restaurantId: 'saffron-premium',
    categoryId: 'cold-starters',
    name: 'Tərəvəz Buketi',
    description: 'Təzə mövsüm tərəvəzləri, yerli göyərtilər və Motal pendiri ilə.',
    price: 12,
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuAo7W5uOjH_9uHf-Xh0xBc5tahwC8r4q0DKl4j_ABObfXUrNceQnfJ-EVTH-69cLlI2zd-EaPjVjfiRRM3_-qJDqw8TUfPZBfWb9NlyOZGhbgVM6O-ZmmRVoi6krLRqos6-7UYZuZGi8OcvoEYy672437662hAUBFcVWWFxMROxnFBUrcdSOYozbSnCTeewduzsnTW1cgZcVPyybWCDiQ-Xt-rRgcGsYIiUKOiEvXHPy4YQGod1b4M34g',
    isActive: true,
  },
  {
    id: 'shah-plov',
    restaurantId: 'saffron-premium',
    categoryId: 'main-dishes',
    name: 'Şah Plov',
    description: 'Qazmaqda bişmiş ətirli uzun düyü, quzu əti, qaysı və şabalıd ilə.',
    price: 45,
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuC8fVezDl0pcb_4ihPxXRuCm75TEJuzqGPCnZYONNK3QdD_XaF5ebDPmWLoAXwZrC36WHCnyYp49atq75RU16nFSRn-IpKmlt1ZwB5b60ikyQH9u_v7gegCDcv4PZJZcIvbJjCJitvHwTg1o6z0e8ZCu9KR9d2-QlPLf2RE6vCTXzXOVo3IMd9NKHhfMDdTMASWvhSXE2NVshadSpcR_Ps5k9zn9p3NCn5olO0-0ORJnvCaL0fedRpCGQ',
    isActive: true,
  },
  {
    id: 'pomegranate-drink',
    restaurantId: 'saffron-premium',
    categoryId: 'drinks',
    name: 'Nar Şərbəti',
    description: 'Təzə sıxılmış nar şirəsi və xüsusi ədviyyat qarışığı.',
    price: 8,
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDRP0HSqnlvLQpDpDAdXNtKLwxnqFDc1E-Enq5SbAJBGHJE0vtJXw10K9_cBDUBh4xUXtn8ivaAuVVXwCj0utV32oT-C8fDZyJ_XFGx1TZc5B_Q4QQGq393bEnVpyKN_ECObfUhynMfwSabmIgngoiUb5I-jl_Jf5kornX40xOAIRVahJPiruNMoML0mN6SifSKeH92hpSNviHyv430vHG7KvSsmWtu5nNlSkcKs7XyLIljOCkgzmRw1Q',
    isActive: true,
  },
  {
    id: 'baku-pakhlava',
    restaurantId: 'saffron-premium',
    categoryId: 'desserts',
    name: 'Bakı Paxlavası',
    description: 'Bal ilə zənginləşdirilmiş, fındıqlı klassik Bakı paxlavası.',
    price: 15,
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuCKpQw6XXiuLFS40HEG07NEgFDj7mRWmXrCihFByl4iZ5GsGoA0oxR90dj75iKuMMU11LSXYkKSvIPRpFqvbXmlWDh9MtjHMSwbew0fzT6L_sq8nunh-46c_4mpzNP6EikR1JpoXZbpl9v0nCJXoKMqVcER653kmYVRV_w-2CSzszsTWX520ScgXwocn5_Yul-754mKZJauq4vXkH4GuZnfktZH4QtllIa5YtXcXF58Sa_v0MhX2XiIXQ',
    isActive: true,
  },
]

export const reservations: Reservation[] = [
  {
    id: 'res-9001',
    restaurantId: 'saffron-premium',
    customerName: 'Aysel Məmmədova',
    tableId: 'table-104',
    waiterId: 'staff-leyla',
    guestCount: 4,
    dateTime: '2026-07-20T19:30:00',
    status: 'Reserved',
    depositStatus: 'Paid',
    selectedMenuItemIds: ['shah-plov', 'pomegranate-drink'],
  },
]

export const orders: Order[] = [
  {
    id: 'ord-501',
    restaurantId: 'saffron-premium',
    reservationId: 'res-9001',
    tableId: 'table-104',
    waiterId: 'staff-leyla',
    source: 'WaiterCreated',
    status: 'Preparing',
    paymentStatus: 'Pending',
    total: 61,
    itemNames: ['Şah Plov x1', 'Nar Şərbəti x2'],
  },
  {
    id: 'ord-502',
    restaurantId: 'saffron-premium',
    tableId: 'table-vip-2',
    waiterId: 'staff-ali',
    source: 'WaiterCreated',
    status: 'Ready',
    paymentStatus: 'Paid',
    total: 112,
    itemNames: ['Nar souslu quzu x3', 'Bakı Paxlavası x2'],
  },
]

export const payments: Payment[] = [
  { id: 'pay-301', restaurantId: 'saffron-premium', target: 'ReservationDeposit', status: 'Paid', amount: 5, provider: 'Payriff', correlationKey: 'res-9001-deposit' },
  { id: 'pay-302', restaurantId: 'saffron-premium', target: 'OrderFinal', status: 'Pending', amount: 67.1, provider: 'Payriff', correlationKey: 'ord-501-final' },
]

export const settlements: StaffSettlement[] = [
  { id: 'set-01', staffId: 'staff-leyla', period: '2026-W29', status: 'Payable', payableAmount: 146 },
  { id: 'set-02', staffId: 'staff-ali', period: '2026-W29', status: 'Open', payableAmount: 92 },
]

export const adminModules: AdminModule[] = [
  { key: 'restaurants', title: 'Restoranlar', singular: 'Restoran', route: '/admin/restaurants', icon: Store, createLabel: 'Yeni restoran', dangerLabel: 'Restoranı deaktiv et', description: 'Profil, aktivlik və contract gate vəziyyəti.', columns: ['Restoran', 'Status', 'Müqavilə', 'Depozit'] },
  { key: 'contracts', title: 'Müqavilələr', singular: 'Müqavilə', route: '/admin/contracts', icon: FileText, createLabel: 'Yeni müqavilə', dangerLabel: 'Müqaviləni ləğv et', description: 'Platforma-restoran kommersiya və hüquqi şərtləri.', columns: ['Müqavilə', 'Status', 'Dövr', 'Ödəniş siyasəti'] },
  { key: 'reservations', title: 'Rezervasiyalar', singular: 'Rezervasiya', route: '/admin/reservations', icon: CalendarDays, description: 'Depozitli masa rezervləri və check-in statusları.', columns: ['Rezerv', 'Status', 'Tarix', 'Depozit'] },
  { key: 'orders', title: 'Sifarişlər', singular: 'Sifariş', route: '/admin/orders', icon: ShoppingBag, description: 'WaiterCreated order lifecycle və online payment statusu.', columns: ['Sifariş', 'Status', 'Mənbə', 'Məbləğ'] },
  { key: 'payments', title: 'Ödənişlər', singular: 'Ödəniş', route: '/admin/payments', icon: CreditCard, description: 'Payriff PaymentIntent, webhook və refund vəziyyəti.', columns: ['Ödəniş', 'Status', 'Provider', 'Məbləğ'] },
  { key: 'staff', title: 'Personal', singular: 'Əməkdaş', route: '/admin/staff', icon: Users, createLabel: 'Yeni əməkdaş', dangerLabel: 'Əməkdaşı deaktiv et', description: 'Rol, fərdi service fee və settlement earning.', columns: ['Əməkdaş', 'Status', 'Rol', 'Qazanc'] },
  { key: 'tables', title: 'Masalar', singular: 'Masa', route: '/admin/tables', icon: Table2, createLabel: 'Yeni masa', dangerLabel: 'Masanı deaktiv et', description: 'Tutum, public görünmə və cari masa statusu.', columns: ['Masa', 'Status', 'Tutum', 'Public'] },
  { key: 'categories', title: 'Kateqoriyalar', singular: 'Kateqoriya', route: '/admin/categories', icon: Tags, createLabel: 'Yeni kateqoriya', dangerLabel: 'Kateqoriyanı deaktiv et', description: 'Public menyu kateqoriyaları.', columns: ['Kateqoriya', 'Status', 'Restoran', 'Item sayı'] },
  { key: 'menu', title: 'Menyu', singular: 'Menyu elementi', route: '/admin/menu', icon: ClipboardList, createLabel: 'Yeni menyu elementi', dangerLabel: 'Menyu elementini deaktiv et', description: 'Məhsul, qiymət, kateqoriya və aktivlik.', columns: ['Məhsul', 'Status', 'Kateqoriya', 'Qiymət'] },
]

export function getRestaurant(id = 'saffron-premium') {
  return restaurants.find((restaurant) => restaurant.id === id) ?? restaurants[0]
}

export function getAdminModule(key: AdminModuleKey) {
  return adminModules.find((module) => module.key === key) ?? adminModules[0]
}

export function getAdminRows(key: AdminModuleKey): AdminRow[] {
  const restaurantName = (id: string) => restaurants.find((restaurant) => restaurant.id === id)?.name ?? id

  const rowMap: Record<AdminModuleKey, AdminRow[]> = {
    restaurants: restaurants.map((restaurant) => ({
      id: restaurant.id,
      title: restaurant.name,
      subtitle: `${restaurant.address} · ${restaurant.phone}`,
      status: restaurant.isActive ? 'Aktiv' : 'Deaktiv',
      tone: restaurant.isActive ? 'success' : 'danger',
      meta: restaurant.hasActiveContract ? 'Active contract' : 'Contract gate bağlı',
      value: `${restaurant.depositAmount} ₼ depozit`,
    })),
    contracts: contracts.map((contract) => ({
      id: contract.id,
      title: contract.contractNumber,
      subtitle: restaurantName(contract.restaurantId),
      status: contract.status,
      tone: contract.status === 'Active' ? 'success' : contract.status === 'PendingSignature' ? 'warning' : 'neutral',
      meta: `${contract.startDate} - ${contract.endDate}`,
      value: contract.paymentPolicy,
    })),
    reservations: reservations.map((reservation) => ({
      id: reservation.id,
      title: reservation.customerName,
      subtitle: `${restaurantName(reservation.restaurantId)} · ${reservation.guestCount} nəfər`,
      status: reservation.status,
      tone: reservation.status === 'Reserved' ? 'success' : 'neutral',
      meta: reservation.dateTime.replace('T', ' '),
      value: reservation.depositStatus,
    })),
    orders: orders.map((order) => ({
      id: order.id,
      title: order.id,
      subtitle: order.itemNames.join(', '),
      status: order.status,
      tone: order.status === 'Ready' ? 'success' : order.status === 'Preparing' ? 'warning' : 'info',
      meta: order.source,
      value: `${order.total.toFixed(2)} ₼`,
    })),
    payments: payments.map((payment) => ({
      id: payment.id,
      title: payment.correlationKey,
      subtitle: payment.target,
      status: payment.status,
      tone: payment.status === 'Paid' ? 'success' : payment.status === 'Pending' ? 'warning' : 'danger',
      meta: payment.provider,
      value: `${payment.amount.toFixed(2)} ₼`,
    })),
    staff: staff.map((member) => ({
      id: member.id,
      title: member.name,
      subtitle: member.phone,
      status: member.status,
      tone: member.status === 'Active' ? 'success' : member.status === 'OnBreak' ? 'warning' : 'neutral',
      meta: member.role,
      value: `${member.currentEarning.toFixed(2)} ₼`,
    })),
    tables: tables.map((table) => ({
      id: table.id,
      title: table.number,
      subtitle: restaurantName(table.restaurantId),
      status: table.status,
      tone: table.status === 'Available' ? 'success' : table.status === 'Reserved' ? 'warning' : 'neutral',
      meta: `${table.capacity} nəfər`,
      value: table.isPublic ? 'Görünür' : 'Gizlidir',
    })),
    categories: menuCategories.map((category) => ({
      id: category.id,
      title: category.name,
      subtitle: restaurantName(category.restaurantId),
      status: category.isActive ? 'Aktiv' : 'Deaktiv',
      tone: category.isActive ? 'success' : 'neutral',
      meta: restaurantName(category.restaurantId),
      value: `${menuItems.filter((item) => item.categoryId === category.id).length} item`,
    })),
    menu: menuItems.map((item) => ({
      id: item.id,
      title: item.name,
      subtitle: item.description,
      status: item.isActive ? 'Aktiv' : 'Deaktiv',
      tone: item.isActive ? 'success' : 'neutral',
      meta: menuCategories.find((category) => category.id === item.categoryId)?.name ?? '-',
      value: `${item.price.toFixed(2)} ₼`,
    })),
  }

  return rowMap[key]
}
