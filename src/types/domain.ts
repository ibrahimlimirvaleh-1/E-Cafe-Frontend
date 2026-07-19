import type { LucideIcon } from 'lucide-react'

export type Restaurant = {
  id: string
  name: string
  cuisine: string
  area: string
  rating: number
  price: string
  image: string
  tags: string[]
}

export type MenuItem = {
  name: string
  category: string
  price: number
  popular?: boolean
}

export type AdminMetric = {
  label: string
  value: string
  hint: string
  tone: 'success' | 'warning' | 'info' | 'danger'
}

export type AdminModule = {
  name: string
  count: string
  icon: LucideIcon
}
