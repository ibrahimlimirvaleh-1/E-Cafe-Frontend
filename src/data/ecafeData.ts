import type { LucideIcon } from 'lucide-react'
import {
  CalendarDays,
  ClipboardList,
  CreditCard,
  FileText,
  ShoppingBag,
  Store,
  Table2,
  Users,
} from 'lucide-react'

export type Tone = 'success' | 'warning' | 'info' | 'danger' | 'neutral'

export type Metric = {
  label: string
  value: string
  hint: string
  tone: Tone
}

export type Restaurant = {
  id: string
  name: string
  cuisine: string
  area: string
  rating: number
  price: string
  status: string
  image: string
  tags: string[]
}

export type MenuProduct = {
  id: string
  title: string
  category: string
  price: string
  status: string
  tone: Tone
  description: string
  image: string
}

export type AdminRow = {
  id: string
  title: string
  subtitle: string
  status: string
  tone: Tone
  meta: string
  value: string
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

export type AdminModuleConfig = {
  key: AdminModuleKey
  title: string
  singular: string
  route: string
  icon: LucideIcon
  summary: string
  createLabel: string
  deactivateLabel: string
  columns: [string, string, string, string]
  rows: AdminRow[]
}

export const customerNav = [
  { label: 'Restoranlar', to: '/' },
  { label: 'Rezervasiyalarım', to: '/reservations' },
  { label: 'Sifarişlərim', to: '/orders' },
  { label: 'Bildirişlər', to: '/notifications' },
]

export const restaurants: Restaurant[] = [
  {
    id: 'saffron-premium',
    name: 'Saffron Premium Lounge',
    cuisine: 'Azərbaycan və Avropa mətbəxi',
    area: 'Nizami küçəsi',
    rating: 4.9,
    price: '₼₼₼',
    status: 'Açıq',
    image:
      'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80',
    tags: ['Ailə zalı', 'Canlı musiqi', 'VIP otaq'],
  },
  {
    id: 'lumina-cafe',
    name: 'Lumina Cafe',
    cuisine: 'Brunch, desert və specialty coffee',
    area: 'Ağ şəhər',
    rating: 4.7,
    price: '₼₼',
    status: 'Açıq',
    image:
      'https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&w=1200&q=80',
    tags: ['Terras', 'Sürətli təsdiq', 'Uşaq menyusu'],
  },
  {
    id: 'terrace-house',
    name: 'The Grand Terrace',
    cuisine: 'Steakhouse və şərab menyusu',
    area: 'Port Baku',
    rating: 4.8,
    price: '₼₼₼',
    status: 'Açıq',
    image:
      'https://images.unsplash.com/photo-1559329007-40df8a9345d8?auto=format&fit=crop&w=1200&q=80',
    tags: ['Ofisiant seçimi', 'Payriff', 'Rezerv masa'],
  },
]

export const menuProducts: MenuProduct[] = [
  {
    id: 'menu-101',
    title: 'Tərəvəz Buketi',
    category: 'Soyuq qəlyanaltılar',
    price: '₼12',
    status: 'Aktiv',
    tone: 'success',
    description: 'Təzə mövsüm tərəvəzləri, yerli göyərtilər və Motal pendiri ilə.',
    image:
      'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?auto=format&fit=crop&w=900&q=80',
  },
  {
    id: 'menu-102',
    title: 'Şah Plov',
    category: 'Əsas yemək',
    price: '₼45',
    status: 'Aktiv',
    tone: 'success',
    description: 'Qazmaqda bişmiş ətirli uzun düyü, quzu əti, qaysı və şabalıd ilə.',
    image:
      'https://images.unsplash.com/photo-1631515243349-e0cb75fb8d3a?auto=format&fit=crop&w=900&q=80',
  },
  {
    id: 'menu-103',
    title: 'Nar Şərbəti',
    category: 'İçkilər',
    price: '₼8',
    status: 'Aktiv',
    tone: 'info',
    description: 'Təzə sıxılmış nar şirəsi və xüsusi ədviyyat qarışığı.',
    image:
      'https://images.unsplash.com/photo-1544145945-f90425340c7e?auto=format&fit=crop&w=900&q=80',
  },
  {
    id: 'menu-104',
    title: 'Bakı Paxlavası',
    category: 'Şirniyyatlar',
    price: '₼15',
    status: 'Aktiv',
    tone: 'warning',
    description: 'Bal ilə zənginləşdirilmiş, fındıqlı klassik Bakı paxlavası.',
    image:
      'https://images.unsplash.com/photo-1606890737304-57a1ca8a5b62?auto=format&fit=crop&w=900&q=80',
  },
  {
    id: 'menu-105',
    title: 'Nar souslu quzu',
    category: 'Əsas yemək',
    price: '₼31',
    status: 'Aktiv',
    tone: 'success',
    description: 'Yavaş bişmiş quzu əti, nar sousu və tərəvəz qarniri.',
    image:
      'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=900&q=80',
  },
  {
    id: 'menu-106',
    title: 'Püstəli Cheesecake',
    category: 'Şirniyyatlar',
    price: '₼10',
    status: 'Stok azdır',
    tone: 'warning',
    description: 'Püstə kremi və giləmeyvə sousu ilə günlük desert.',
    image:
      'https://images.unsplash.com/photo-1533134242443-d4fd215305ad?auto=format&fit=crop&w=900&q=80',
  },
]

export const adminMetrics: Metric[] = [
  { label: 'Bugünkü rezervasiya', value: '24', hint: '+6 dünənə görə', tone: 'success' },
  { label: 'Aktiv sifariş', value: '15', hint: '4 masa gözləyir', tone: 'warning' },
  { label: 'Ödəniş dövriyyəsi', value: '₼2,840', hint: '96% kart ilə', tone: 'info' },
  { label: 'Personal növbədə', value: '18', hint: '3 nəfər əlavə çağırılıb', tone: 'neutral' },
]

export const waiterMetrics: Metric[] = [
  { label: 'Rezervasiyalar', value: '8', hint: '3-ü növbəti saatdadır', tone: 'info' },
  { label: 'Gözləyən sifariş', value: '5', hint: 'Mətbəxdə hazırlanır', tone: 'warning' },
  { label: 'Aktiv masalar', value: '12', hint: '2 masa hesab istəyir', tone: 'success' },
]

export const kitchenTickets: AdminRow[] = [
  {
    id: 'order-501',
    title: 'Masa T-104',
    subtitle: 'Şah plov x2, Tərəvəz buketi x1',
    status: 'Hazırlanır',
    tone: 'warning',
    meta: '12 dəq əvvəl',
    value: 'Prioritet',
  },
  {
    id: 'order-502',
    title: 'Masa VIP-2',
    subtitle: 'Nar souslu quzu x3, Cheesecake x2',
    status: 'Yeni',
    tone: 'info',
    meta: '4 dəq əvvəl',
    value: 'VIP',
  },
  {
    id: 'order-503',
    title: 'Masa T-101',
    subtitle: 'Brunch set x2, Latte x2',
    status: 'Hazırdır',
    tone: 'success',
    meta: 'İndi',
    value: 'Ofisianta ver',
  },
]

const moduleRows: Record<AdminModuleKey, AdminRow[]> = {
  restaurants: [
    {
      id: 'saffron-premium',
      title: 'Saffron Premium Lounge',
      subtitle: 'Nizami küçəsi, 18 masa',
      status: 'Aktiv',
      tone: 'success',
      meta: 'Premium paket',
      value: '₼1,250 / ay',
    },
    {
      id: 'lumina-cafe',
      title: 'Lumina Cafe',
      subtitle: 'Ağ şəhər, 12 masa',
      status: 'Aktiv',
      tone: 'success',
      meta: 'Standart paket',
      value: '₼680 / ay',
    },
  ],
  contracts: [
    {
      id: 'contract-102',
      title: 'Saffron Premium müqaviləsi',
      subtitle: '2026-01-15 - 2027-01-15',
      status: 'Aktiv',
      tone: 'success',
      meta: 'İllik paket',
      value: '₼15,000',
    },
    {
      id: 'contract-117',
      title: 'Lumina Cafe müqaviləsi',
      subtitle: '2026-03-01 - 2026-09-01',
      status: 'Yenilənməlidir',
      tone: 'warning',
      meta: '6 aylıq paket',
      value: '₼4,080',
    },
  ],
  reservations: [
    {
      id: 'reservation-701',
      title: 'Aysel Məmmədova',
      subtitle: 'Saffron Premium, T-104',
      status: 'Təsdiqlənib',
      tone: 'success',
      meta: 'Bu gün, 20:30',
      value: '4 nəfər',
    },
    {
      id: 'reservation-702',
      title: 'Kamran Əliyev',
      subtitle: 'The Grand Terrace, VIP-2',
      status: 'Gözləyir',
      tone: 'warning',
      meta: 'Sabah, 19:00',
      value: '6 nəfər',
    },
  ],
  orders: [
    {
      id: 'order-501',
      title: 'Sifariş #501',
      subtitle: 'Masa T-104, 3 məhsul',
      status: 'Hazırlanır',
      tone: 'warning',
      meta: 'Saffron Premium',
      value: '₼60',
    },
    {
      id: 'order-502',
      title: 'Sifariş #502',
      subtitle: 'Masa VIP-2, 5 məhsul',
      status: 'Yeni',
      tone: 'info',
      meta: 'The Grand Terrace',
      value: '₼133',
    },
  ],
  payments: [
    {
      id: 'payment-311',
      title: 'Payriff ödənişi',
      subtitle: 'Sifariş #501',
      status: 'Tamamlandı',
      tone: 'success',
      meta: 'Visa kart',
      value: '₼60',
    },
    {
      id: 'payment-312',
      title: 'Kart ödənişi',
      subtitle: 'Rezervasiya depoziti',
      status: 'Pending',
      tone: 'warning',
      meta: 'Mastercard',
      value: '₼30',
    },
  ],
  staff: [
    {
      id: 'staff-201',
      title: 'Anar Məmmədov',
      subtitle: 'Ofisiant, axşam növbəsi',
      status: 'Aktiv',
      tone: 'success',
      meta: '4.9 reytinq',
      value: '12 masa',
    },
    {
      id: 'staff-202',
      title: 'Leyla Əliyeva',
      subtitle: 'Restoran meneceri',
      status: 'Aktiv',
      tone: 'success',
      meta: 'Admin panel',
      value: '8 əməkdaş',
    },
  ],
  tables: [
    {
      id: 'table-101',
      title: 'T-101',
      subtitle: 'Standart masa, zal 1',
      status: 'Boşdur',
      tone: 'success',
      meta: '2-4 nəfər',
      value: '₼0 depozit',
    },
    {
      id: 'table-vip-2',
      title: 'VIP-2',
      subtitle: 'VIP otaq, zal 2',
      status: 'Rezervdir',
      tone: 'warning',
      meta: '6 nəfər',
      value: '₼30 depozit',
    },
  ],
  categories: [
    {
      id: 'category-main',
      title: 'Əsas yeməklər',
      subtitle: 'Menyu kateqoriyası',
      status: 'Aktiv',
      tone: 'success',
      meta: '18 məhsul',
      value: 'Sıra 1',
    },
    {
      id: 'category-dessert',
      title: 'Desertlər',
      subtitle: 'Menyu kateqoriyası',
      status: 'Aktiv',
      tone: 'success',
      meta: '9 məhsul',
      value: 'Sıra 4',
    },
  ],
  menu: menuProducts.map((item) => ({
    id: item.id,
    title: item.title,
    subtitle: item.description,
    status: item.status,
    tone: item.tone,
    meta: item.category,
    value: item.price,
  })),
}

export const adminModules: AdminModuleConfig[] = [
  {
    key: 'restaurants',
    title: 'Restoranlar',
    singular: 'Restoran',
    route: '/admin/restaurants',
    icon: Store,
    summary: 'Restoran profilləri, ünvanlar, paketlər və aktivlik statusu.',
    createLabel: 'Yeni restoran yarat',
    deactivateLabel: 'Restoranı deaktiv et',
    columns: ['Restoran', 'Status', 'Paket', 'Dəyər'],
    rows: moduleRows.restaurants,
  },
  {
    key: 'contracts',
    title: 'Müqavilələr',
    singular: 'Müqavilə',
    route: '/admin/contracts',
    icon: FileText,
    summary: 'Restoran müqavilələri, müddətlər, tariflər və ləğv prosesi.',
    createLabel: 'Yeni müqavilə yarat',
    deactivateLabel: 'Müqaviləni ləğv et',
    columns: ['Müqavilə', 'Status', 'Müddət', 'Məbləğ'],
    rows: moduleRows.contracts,
  },
  {
    key: 'reservations',
    title: 'Rezervasiyalar',
    singular: 'Rezervasiya',
    route: '/admin/reservations',
    icon: CalendarDays,
    summary: 'Müştəri rezervasiyaları, masa seçimi və təsdiq statusları.',
    createLabel: 'Yeni rezervasiya yarat',
    deactivateLabel: 'Rezervasiyanı ləğv et',
    columns: ['Müştəri', 'Status', 'Vaxt', 'Qonaq'],
    rows: moduleRows.reservations,
  },
  {
    key: 'orders',
    title: 'Sifarişlər',
    singular: 'Sifariş',
    route: '/admin/orders',
    icon: ClipboardList,
    summary: 'Mətbəxə gedən və tamamlanan sifarişlərin idarə paneli.',
    createLabel: 'Yeni sifariş yarat',
    deactivateLabel: 'Sifarişi ləğv et',
    columns: ['Sifariş', 'Status', 'Restoran', 'Məbləğ'],
    rows: moduleRows.orders,
  },
  {
    key: 'payments',
    title: 'Ödənişlər',
    singular: 'Ödəniş',
    route: '/admin/payments',
    icon: CreditCard,
    summary: 'Kart, depozit və Payriff ödənişlərinin izlənməsi.',
    createLabel: 'Yeni ödəniş yarat',
    deactivateLabel: 'Ödənişi ləğv et',
    columns: ['Ödəniş', 'Status', 'Metod', 'Məbləğ'],
    rows: moduleRows.payments,
  },
  {
    key: 'staff',
    title: 'Personal',
    singular: 'Əməkdaş',
    route: '/admin/staff',
    icon: Users,
    summary: 'Ofisiantlar, menecerlər, rollar və növbə cədvəlləri.',
    createLabel: 'Yeni əməkdaş yarat',
    deactivateLabel: 'Əməkdaşı deaktiv et',
    columns: ['Əməkdaş', 'Status', 'Rol', 'Yük'],
    rows: moduleRows.staff,
  },
  {
    key: 'tables',
    title: 'Masalar',
    singular: 'Masa',
    route: '/admin/tables',
    icon: Table2,
    summary: 'Masa planı, tutum, depozit və rezerv statusları.',
    createLabel: 'Yeni masa yarat',
    deactivateLabel: 'Masanı deaktiv et',
    columns: ['Masa', 'Status', 'Tutum', 'Depozit'],
    rows: moduleRows.tables,
  },
  {
    key: 'categories',
    title: 'Kateqoriyalar',
    singular: 'Kateqoriya',
    route: '/admin/categories',
    icon: ShoppingBag,
    summary: 'Menyu kateqoriyaları, sıralama və aktivlik statusu.',
    createLabel: 'Yeni kateqoriya yarat',
    deactivateLabel: 'Kateqoriyanı deaktiv et',
    columns: ['Kateqoriya', 'Status', 'Məhsul', 'Sıra'],
    rows: moduleRows.categories,
  },
  {
    key: 'menu',
    title: 'Menyu',
    singular: 'Menyu elementi',
    route: '/admin/menu',
    icon: ShoppingBag,
    summary: 'Menyu məhsulları, qiymətlər, kateqoriyalar və stok vəziyyəti.',
    createLabel: 'Yeni menyu elementi',
    deactivateLabel: 'Menyu elementini deaktiv et',
    columns: ['Məhsul', 'Status', 'Kateqoriya', 'Qiymət'],
    rows: moduleRows.menu,
  },
]

export const getAdminModule = (key: AdminModuleKey) =>
  adminModules.find((module) => module.key === key) ?? adminModules[0]

export const getAdminRow = (key: AdminModuleKey, id?: string) => {
  const module = getAdminModule(key)
  return module.rows.find((row) => row.id === id) ?? module.rows[0]
}
