import {
  contracts,
  getAdminRows,
  getRestaurant,
  menuCategories,
  menuItems,
  orders,
  payments,
  reservations,
  restaurants,
  settlements,
  staff,
  tables,
} from '../../entities/mockData'
import type { AdminModuleKey } from '../../entities/types'

export const ecafeApi = {
  restaurants: {
    list: () => restaurants,
    detail: (id: string) => getRestaurant(id),
  },
  contracts: {
    list: () => contracts,
    hasActiveContract: (restaurantId: string) =>
      contracts.some((contract) => contract.restaurantId === restaurantId && contract.status === 'Active'),
  },
  tables: {
    listAvailable: (restaurantId: string, guestCount: number) =>
      tables.filter((table) => table.restaurantId === restaurantId && table.isPublic && table.capacity >= guestCount),
  },
  staff: {
    waiters: (restaurantId: string) =>
      staff.filter((member) => member.restaurantId === restaurantId && member.role === 'Waiter' && member.status !== 'Inactive'),
    list: () => staff,
  },
  menu: {
    categories: (restaurantId: string) => menuCategories.filter((category) => category.restaurantId === restaurantId && category.isActive),
    items: (restaurantId: string) => menuItems.filter((item) => item.restaurantId === restaurantId && item.isActive),
  },
  reservations: {
    list: () => reservations,
  },
  orders: {
    list: () => orders,
  },
  payments: {
    list: () => payments,
  },
  settlements: {
    list: () => settlements,
  },
  admin: {
    rows: (key: AdminModuleKey) => getAdminRows(key),
  },
}
