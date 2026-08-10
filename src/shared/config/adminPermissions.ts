import type { AdminModuleKey } from '../../entities/types'

export const adminModulePermissions: Record<AdminModuleKey, string[]> = {
  restaurants: ['ManageRestaurants', 'ViewRestaurantInfo'],
  'restaurant-groups': ['ManageRestaurants'],
  contracts: ['ManageRestaurantContracts', 'ViewRestaurantContracts'],
  reservations: ['ManageReservations', 'ViewAssignedReservations'],
  orders: ['ManageOrders'],
  payments: ['ManagePayments'],
  staff: ['ManageStaff'],
  tables: ['ManageTables'],
  categories: ['ManageCatalog'],
  menu: ['ManageCatalog'],
  inventory: ['ViewInventory', 'ManageInventory'],
  'inventory-movements': ['ViewInventory', 'ManageInventory'],
  recipes: ['ViewRecipes', 'ManageRecipes'],
  'audit-logs': ['ViewAuditLogs'],
}
