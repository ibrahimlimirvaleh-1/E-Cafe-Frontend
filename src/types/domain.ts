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

export type MetricTone = 'success' | 'warning' | 'info' | 'danger'

export type Metric = {
  label: string
  value: string
  hint: string
  tone: MetricTone
}

export type AdminModule = {
  name: string
  count: string
  icon: LucideIcon
}

export type ReservationOption = {
  id: string
  label: string
  detail: string
  note: string
}
