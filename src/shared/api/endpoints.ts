export const endpoints = {
  auth: {
    login: '/user/login',
    register: '/user/register',
    refresh: '/user/refresh',
  },
  restaurants: {
    adminList: '/restaurants/getAll',
    create: '/admin/restaurants',
    adminDetail: (restaurantId: string) => `/restaurant/getById/${restaurantId}`,
    update: (restaurantId: string) => `/admin/restaurants/${restaurantId}`,
    deactivate: (restaurantId: string) => `/admin/restaurants/${restaurantId}/deactivate`,
    publicList: '/public/restaurants',
    publicDetail: (restaurantId: string) => `/public/restaurants/${restaurantId}`,
  },
  restaurantGroups: {
    list: '/restaurant-groups',
    create: '/restaurant-groups',
  },
  lookups: {
    roles: '/lookups/roles',
    itemStatuses: '/lookups/item-statuses',
    contractStatuses: '/lookups/contract-statuses',
    paymentPolicies: '/lookups/payment-policies',
  },
  contracts: {
    list: (restaurantId: string) => `/restaurants/${restaurantId}/contracts`,
    create: (restaurantId: string) => `/admin/restaurants/${restaurantId}/contracts`,
    update: (restaurantId: string, contractId: string) => `/admin/restaurants/${restaurantId}/contracts/${contractId}`,
    active: (restaurantId: string) => `/restaurants/${restaurantId}/contracts/active`,
    sendForSignature: (restaurantId: string, contractId: string) =>
      `/admin/restaurants/${restaurantId}/contracts/${contractId}/send-for-signature`,
    approve: (restaurantId: string, contractId: string) => `/restaurants/${restaurantId}/contracts/${contractId}/approve`,
    activate: (restaurantId: string, contractId: string) => `/admin/restaurants/${restaurantId}/contracts/${contractId}/activate`,
    terminate: (restaurantId: string, contractId: string) => `/admin/restaurants/${restaurantId}/contracts/${contractId}/terminate`,
  },
  publicRestaurant: {
    menu: (restaurantId: string) => `/public/restaurants/${restaurantId}/menu`,
    staff: (restaurantId: string) => `/public/restaurants/${restaurantId}/staff`,
    tables: (restaurantId: string) => `/public/restaurants/${restaurantId}/tables`,
  },
  menu: {
    categories: (restaurantId: string) => `/category/${restaurantId}`,
    createCategory: (restaurantId: string) => `/restaurants/${restaurantId}/categories`,
    items: '/items/getAll',
    createItem: (restaurantId: string) => `/restaurants/${restaurantId}/items`,
  },
  tables: {
    list: (restaurantId: string) => `/restaurants/${restaurantId}/tables`,
    create: (restaurantId: string) => `/restaurants/${restaurantId}/tables`,
  },
  staff: {
    list: (restaurantId: string) => `/staff/${restaurantId}`,
  },
  users: {
    create: '/users',
    delete: (userId: string) => `/users/${userId}`,
    updateRole: (userId: string) => `/users/${userId}/role`,
    adminList: '/admin/users',
  },
  profile: {
    get: '/profile',
    update: '/profile',
  },
  notifications: {
    list: '/notifications',
    unreadCount: '/notifications/unread-count',
    markAsRead: (notificationId: string) => `/notifications/${notificationId}/read`,
    markAllAsRead: '/notifications/read-all',
  },
  workflow: {
    actions: (flowCode: string) => `/workflows/${flowCode}/actions`,
  },
  files: {
    upload: '/file/upload',
    metadata: (fileId: string) => `/file/${fileId}`,
    delete: (fileId: string) => `/file/${fileId}`,
  },
  auditLogs: {
    list: (restaurantId: string) => `/restaurants/${restaurantId}/audit-logs`,
  },
}
