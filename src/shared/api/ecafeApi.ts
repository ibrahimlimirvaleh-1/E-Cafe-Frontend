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
import type { AdminModuleKey, AdminRow } from '../../entities/types'
import { endpoints } from './endpoints'
import { httpClient, saveAccessToken } from './httpClient'
import {
  categoryRow,
  contractRow,
  mapCategory,
  mapContract,
  mapMenuItem,
  mapRestaurant,
  mapStaff,
  mapTable,
  menuRow,
  restaurantRow,
  staffRow,
  tableRow,
} from './mappers'
import type { AnyRecord } from './responseUtils'
import { asArray, str } from './responseUtils'

type LoginRequest = {
  email: string
  password: string
}

type RegisterRequest = {
  name: string
  surname: string
  email: string
  password: string
}

async function safe<T>(request: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await request()
  } catch {
    return fallback
  }
}

function extractToken(data: unknown) {
  if (!data || typeof data !== 'object') {
    return ''
  }

  const record = data as AnyRecord
  return str(record.accessToken || record.token || record.jwtToken || record.jwt || record.access_token)
}

async function listRestaurants(query = '') {
  const result = await httpClient<unknown>(`${endpoints.restaurants.adminList}${query}`)
  return asArray<AnyRecord>(result.data).map(mapRestaurant)
}

export const ecafeApi = {
  auth: {
    login: async (request: LoginRequest) => {
      const result = await httpClient<unknown>(endpoints.auth.login, {
        method: 'POST',
        body: JSON.stringify(request),
      })
      const token = extractToken(result.data)
      if (token) {
        saveAccessToken(token)
      }
      return result.data
    },
    register: async (request: RegisterRequest) => {
      const result = await httpClient<unknown>(endpoints.auth.register, {
        method: 'POST',
        body: JSON.stringify(request),
      })
      return result.data
    },
  },

  restaurants: {
    list: (query = '') => safe(() => listRestaurants(query), restaurants),
    publicList: (query = '') =>
      safe(async () => {
        const result = await httpClient<unknown>(`${endpoints.restaurants.publicList}${query}`)
        return asArray<AnyRecord>(result.data).map(mapRestaurant)
      }, restaurants.filter((restaurant) => restaurant.isActive && restaurant.hasActiveContract)),
    detail: (id: string) =>
      safe(async () => {
        const result = await httpClient<unknown>(endpoints.restaurants.publicDetail(id))
        return mapRestaurant(result.data as AnyRecord)
      }, getRestaurant(id)),
  },

  contracts: {
    list: (restaurantId: string) =>
      safe(async () => {
        const result = await httpClient<unknown>(endpoints.contracts.list(restaurantId))
        return asArray<AnyRecord>(result.data).map((contract) => mapContract(contract, restaurantId))
      }, contracts.filter((contract) => contract.restaurantId === restaurantId)),
    listAll: () =>
      safe(async () => {
        const restaurantList = await listRestaurants()
        const entries = await Promise.all(
          restaurantList.map(async (restaurant) => ({
            restaurant,
            contracts: await ecafeApi.contracts.list(restaurant.id),
          })),
        )
        return entries.flatMap((entry) => entry.contracts.map((contract) => contractRow(contract, entry.restaurant.name)))
      }, getAdminRows('contracts')),
    hasActiveContract: (restaurantId: string) =>
      contracts.some((contract) => contract.restaurantId === restaurantId && contract.status === 'Active'),
  },

  tables: {
    listPublic: (restaurantId: string) =>
      safe(async () => {
        const result = await httpClient<unknown>(endpoints.publicRestaurant.tables(restaurantId))
        return asArray<AnyRecord>(result.data).map((table) => mapTable(table, restaurantId))
      }, tables.filter((table) => table.restaurantId === restaurantId && table.isPublic)),
    listAvailable: async (restaurantId: string, guestCount: number) => {
      const tableList = await ecafeApi.tables.listPublic(restaurantId)
      return tableList.filter((table) => table.capacity >= guestCount)
    },
  },

  staff: {
    waiters: (restaurantId: string) =>
      safe(async () => {
        const result = await httpClient<unknown>(endpoints.publicRestaurant.staff(restaurantId))
        return asArray<AnyRecord>(result.data)
          .map((member) => mapStaff(member, restaurantId))
          .filter((member) => member.role === 'Waiter' && member.status !== 'Inactive')
      }, staff.filter((member) => member.restaurantId === restaurantId && member.role === 'Waiter' && member.status !== 'Inactive')),
    list: () => staff,
  },

  menu: {
    categories: (restaurantId: string) =>
      safe(async () => {
        const result = await httpClient<unknown>(endpoints.menu.categories(restaurantId))
        return asArray<AnyRecord>(result.data).map((category) => mapCategory(category, restaurantId))
      }, menuCategories.filter((category) => category.restaurantId === restaurantId && category.isActive)),
    items: (restaurantId: string) =>
      safe(async () => {
        const result = await httpClient<unknown>(endpoints.publicRestaurant.menu(restaurantId))
        return asArray<AnyRecord>(result.data).map((item) => mapMenuItem(item, restaurantId))
      }, menuItems.filter((item) => item.restaurantId === restaurantId && item.isActive)),
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
    rows: async (key: AdminModuleKey): Promise<AdminRow[]> => {
      if (key === 'restaurants') {
        const restaurantList = await ecafeApi.restaurants.list()
        return restaurantList.map(restaurantRow)
      }

      if (key === 'contracts') {
        return ecafeApi.contracts.listAll()
      }

      if (key === 'tables') {
        const restaurantList = await ecafeApi.restaurants.list()
        const tableGroups = await Promise.all(restaurantList.map((restaurant) => ecafeApi.tables.listPublic(restaurant.id)))
        return tableGroups.flat().map(tableRow)
      }

      if (key === 'staff') {
        const restaurantList = await ecafeApi.restaurants.list()
        const staffGroups = await Promise.all(restaurantList.map((restaurant) => ecafeApi.staff.waiters(restaurant.id)))
        return staffGroups.flat().map(staffRow)
      }

      if (key === 'categories') {
        const restaurantList = await ecafeApi.restaurants.list()
        const categoryGroups = await Promise.all(restaurantList.map((restaurant) => ecafeApi.menu.categories(restaurant.id)))
        return categoryGroups.flat().map(categoryRow)
      }

      if (key === 'menu') {
        const restaurantList = await ecafeApi.restaurants.list()
        const itemGroups = await Promise.all(restaurantList.map((restaurant) => ecafeApi.menu.items(restaurant.id)))
        return itemGroups.flat().map(menuRow)
      }

      return getAdminRows(key)
    },
  },
}
