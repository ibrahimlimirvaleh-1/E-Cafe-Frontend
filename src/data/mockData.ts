import {
  CalendarDays,
  CreditCard,
  ShoppingBag,
  Store,
  Table2,
  Users,
} from 'lucide-react'
import type { AdminMetric, AdminModule, MenuItem, Restaurant } from '../types/domain'

export const restaurants: Restaurant[] = [
  {
    id: 'saffron-premium',
    name: 'Saffron Premium Lounge',
    cuisine: 'Azərbaycan və Avropa mətbəxi',
    area: 'Nizami küçəsi',
    rating: 4.9,
    price: '₼₼₼',
    image:
      'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80',
    tags: ['Pre-order', 'Ailə zalı', 'Canlı musiqi'],
  },
  {
    id: 'lumina-cafe',
    name: 'Lumina Cafe',
    cuisine: 'Brunch, desert və specialty coffee',
    area: 'Ağ şəhər',
    rating: 4.7,
    price: '₼₼',
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
    image:
      'https://images.unsplash.com/photo-1559329007-40df8a9345d8?auto=format&fit=crop&w=1200&q=80',
    tags: ['VIP otaq', 'Ofisiant seçimi', 'Payriff'],
  },
]

export const menuItems: MenuItem[] = [
  { name: 'Şah plov', category: 'Əsas yemək', price: 24, popular: true },
  { name: 'Nar souslu quzu', category: 'Əsas yemək', price: 31, popular: true },
  { name: 'Tərəvəz buketi', category: 'Salat', price: 12 },
  { name: 'Püstəli cheesecake', category: 'Desert', price: 10 },
]

export const adminMetrics: AdminMetric[] = [
  { label: 'Bugünkü rezervasiya', value: '24', hint: '+6 dünənə görə', tone: 'success' },
  { label: 'Aktiv sifariş', value: '15', hint: '4 masa gözləyir', tone: 'warning' },
  { label: 'Ödəniş dövriyyəsi', value: '₼2,840', hint: 'Payriff ilə 96%', tone: 'info' },
  { label: 'Cüzdan balansı', value: '₼12,450', hint: '₼1,200 pending', tone: 'success' },
]

export const adminModules: AdminModule[] = [
  { name: 'Restoranlar', count: '24', icon: Store },
  { name: 'Masalar', count: '126', icon: Table2 },
  { name: 'Heyət', count: '38', icon: Users },
  { name: 'Menyu', count: '312', icon: ShoppingBag },
  { name: 'Rezervasiyalar', count: '87', icon: CalendarDays },
  { name: 'Ödənişlər', count: '₼18k', icon: CreditCard },
]
