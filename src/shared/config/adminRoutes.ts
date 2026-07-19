import type { AdminModuleKey } from '../../entities/types'

export type AdminRouteConfig = {
  key: AdminModuleKey
  paramName: string
  supportsCreate: boolean
  dangerAction?: 'deactivate' | 'terminate'
}

export const adminRouteConfig: AdminRouteConfig[] = [
  { key: 'restaurants', paramName: 'restaurantId', supportsCreate: true, dangerAction: 'deactivate' },
  { key: 'contracts', paramName: 'contractId', supportsCreate: true, dangerAction: 'terminate' },
  { key: 'reservations', paramName: 'reservationId', supportsCreate: false },
  { key: 'orders', paramName: 'orderId', supportsCreate: false },
  { key: 'payments', paramName: 'paymentId', supportsCreate: false },
  { key: 'staff', paramName: 'staffId', supportsCreate: true, dangerAction: 'deactivate' },
  { key: 'tables', paramName: 'tableId', supportsCreate: true, dangerAction: 'deactivate' },
  { key: 'categories', paramName: 'categoryId', supportsCreate: true, dangerAction: 'deactivate' },
  { key: 'menu', paramName: 'itemId', supportsCreate: true, dangerAction: 'deactivate' },
]
