export type KitchenProgressAction = 'accept' | 'start' | 'ready'

export const endpoints = {
  mobileApp: {
    customerRelease: '/mobile/customer/release',
    customerDownload: '/mobile/customer/download',
    restaurantModule: (restaurantId: string) => `/admin/restaurants/${restaurantId}/mobile-module`,
    staffRelease: (restaurantId: string) => `/restaurants/${restaurantId}/mobile-app/release`,
    staffDownload: (restaurantId: string) => `/restaurants/${restaurantId}/mobile-app/download`,
  },
  schedule: {
    get: (id: string) => `/restaurants/${id}/schedule-change`,
    apply: (id: string) => `/restaurants/${id}/schedule-change/apply`,
    withdraw: (id: string) => `/restaurants/${id}/schedule-change/withdraw`,
    session: (id: string, consentId: number) => `/restaurants/${id}/schedule-change/sessions/${consentId}/response`,
    offer: (id: string) => `/public/reservations/${id}/schedule-offer`,
    respond: (id: string) => `/public/reservations/${id}/schedule-offer/response`,
  },
  auth: {
    login: '/user/login',
    register: '/user/register',
    setPassword: '/user/set-password',
    forgotPassword: '/user/forgot-password',
    resetPassword: '/user/reset-password',
    refresh: '/user/refresh',
    logout: '/user/logout',
    logoutAll: '/user/logout-all',
  },
  restaurants: {
    adminList: '/restaurants/getAll',
    create: '/admin/restaurants',
    geocode: '/admin/restaurants/geocode',
    adminDetail: (restaurantId: string) => `/restaurant/getById/${restaurantId}`,
    update: (restaurantId: string) => `/admin/restaurants/${restaurantId}`,
    depositRule: (restaurantId: string, reservationDate: string) =>
      `/admin/restaurants/${restaurantId}/deposit-rules/${encodeURIComponent(reservationDate)}`,
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
    units: '/lookups/units',
    inventoryMovementTypes: '/lookups/inventory-movement-types',
    contractStatuses: '/lookups/contract-statuses',
    paymentPolicies: '/lookups/payment-policies',
    auditActions: '/lookups/audit-actions',
    outboxStatuses: '/lookups/outbox-statuses',
    notificationChannels: '/lookups/notification-channels',
  },
  contracts: {
    list: (restaurantId: string) => `/restaurants/${restaurantId}/contracts`,
    paged: (restaurantId: string) => `/restaurants/${restaurantId}/contracts/paged`,
    create: (restaurantId: string) => `/admin/restaurants/${restaurantId}/contracts`,
    update: (restaurantId: string, contractId: string) => `/admin/restaurants/${restaurantId}/contracts/${contractId}`,
    active: (restaurantId: string) => `/restaurants/${restaurantId}/contracts/active`,
    actions: (restaurantId: string, contractId: string) => `/restaurants/${restaurantId}/contracts/${contractId}/actions`,
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
    tableAvailability: (restaurantId: string, reservedAt: string) =>
      `/public/restaurants/${restaurantId}/tables/availability?reservedAt=${encodeURIComponent(reservedAt)}`,
    availableTables: (restaurantId: string, reservedAt: string) =>
      `/public/restaurants/${restaurantId}/tables/available?reservedAt=${encodeURIComponent(reservedAt)}`,
  },
  reservations: {
    create: (restaurantId: string) => `/restaurants/${restaurantId}/reservations`,
    my: '/public/reservations/my',
    getById: (reservationId: string) => `/public/reservations/${reservationId}`,
    history: (reservationId: string) => `/public/reservations/${reservationId}/history`,
    arrivalOptions: (reservationId: string) => `/public/reservations/${reservationId}/late-arrival`,
    arrivalOffer: (reservationId: string) => `/public/reservations/${reservationId}/late-arrival/offers`,
    arrivalAccept: (reservationId: string) => `/public/reservations/${reservationId}/late-arrival/accept`,
    refund: (reservationId: string) => `/public/reservations/${reservationId}/refund`,
    restaurantRefund: (restaurantId: string, reservationId: string) =>
      `/restaurants/${restaurantId}/reservations/${reservationId}/refund`,
    payment: (reservationId: string) => `/reservations/${reservationId}/payment`,
    paymentCheckout: (reservationId: string) => `/reservations/${reservationId}/payment/checkout`,
    authorizePayment: (restaurantId: string, reservationId: string) =>
      `/restaurants/${restaurantId}/reservations/${reservationId}/payment/authorize`,
    restaurantList: (restaurantId: string) => `/restaurants/${restaurantId}/reservations`,
    restaurantService: (restaurantId: string) => `/restaurants/${restaurantId}/reservations/service`,
    restaurantDetail: (restaurantId: string, reservationId: string) => `/restaurants/${restaurantId}/reservations/${reservationId}`,
    departure: (restaurantId: string, reservationId: string) =>
      `/restaurants/${restaurantId}/reservations/${reservationId}/departure`,
    tableChange: (restaurantId: string, reservationId: string) =>
      `/restaurants/${restaurantId}/reservations/${reservationId}/table-change`,
    complete: (restaurantId: string, reservationId: string) =>
      `/restaurants/${restaurantId}/reservations/${reservationId}/complete`,
    completeService: (restaurantId: string, reservationId: string) =>
      `/restaurants/${restaurantId}/reservations/${reservationId}/complete-service`,
    restaurantHistory: (restaurantId: string, reservationId: string) =>
      `/restaurants/${restaurantId}/reservations/${reservationId}/history`,
    customerCancel: (reservationId: string) => `/public/reservations/${reservationId}/cancel`,
    restaurantCancel: (restaurantId: string, reservationId: string) =>
      `/restaurants/${restaurantId}/reservations/${reservationId}/cancel`,
  },
  payments: {
    capabilities: '/payments/capabilities',
    refresh: (paymentId: number) => `/payments/${paymentId}/refresh`,
    testOutcome: (paymentId: number) => `/payments/${paymentId}/test-outcome`,
  },
  refunds: {
    refresh: (refundId: number) => `/refunds/${refundId}/refresh`,
    testOutcome: (refundId: number) => `/refunds/${refundId}/test-outcome`,
  },
  menu: {
    categories: (restaurantId: string) => `/category/${restaurantId}`,
    createCategory: (restaurantId: string) => `/restaurants/${restaurantId}/categories`,
    updateCategory: (restaurantId: string, categoryId: string) => `/restaurants/${restaurantId}/categories/${categoryId}`,
    activateCategory: (restaurantId: string, categoryId: string) => `/restaurants/${restaurantId}/categories/${categoryId}/activate`,
    deactivateCategory: (restaurantId: string, categoryId: string) => `/restaurants/${restaurantId}/categories/${categoryId}/deactivate`,
    deleteCategory: (restaurantId: string, categoryId: string) => `/restaurants/${restaurantId}/categories/${categoryId}`,
    items: '/items/getAll',
    createItem: (restaurantId: string) => `/restaurants/${restaurantId}/items`,
    updateItem: (restaurantId: string, itemId: string) => `/restaurants/${restaurantId}/items/${itemId}`,
    deactivateItem: (restaurantId: string, itemId: string) => `/restaurants/${restaurantId}/items/${itemId}/deactivate`,
    deleteItem: (restaurantId: string, itemId: string) => `/restaurants/${restaurantId}/items/${itemId}`,
  },
  inventory: {
    list: (restaurantId: string) => `/restaurants/${restaurantId}/inventory`,
    detail: (restaurantId: string, inventoryItemId: string) => `/restaurants/${restaurantId}/inventory/${inventoryItemId}`,
    create: (restaurantId: string) => `/restaurants/${restaurantId}/inventory`,
    update: (restaurantId: string, inventoryItemId: string) => `/restaurants/${restaurantId}/inventory/${inventoryItemId}`,
    activate: (restaurantId: string, inventoryItemId: string) => `/restaurants/${restaurantId}/inventory/${inventoryItemId}/activate`,
    deactivate: (restaurantId: string, inventoryItemId: string) => `/restaurants/${restaurantId}/inventory/${inventoryItemId}/deactivate`,
    delete: (restaurantId: string, inventoryItemId: string) => `/restaurants/${restaurantId}/inventory/${inventoryItemId}`,
    movements: (restaurantId: string, inventoryItemId: string) => `/restaurants/${restaurantId}/inventory/${inventoryItemId}/movements`,
  },
  recipes: {
    list: (restaurantId: string, itemId: string) => `/restaurants/${restaurantId}/items/${itemId}/recipes`,
    create: (restaurantId: string, itemId: string) => `/restaurants/${restaurantId}/items/${itemId}/recipes`,
    update: (restaurantId: string, itemId: string, recipeId: string) => `/restaurants/${restaurantId}/items/${itemId}/recipes/${recipeId}`,
    activate: (restaurantId: string, itemId: string, recipeId: string) => `/restaurants/${restaurantId}/items/${itemId}/recipes/${recipeId}/activate`,
    deactivate: (restaurantId: string, itemId: string, recipeId: string) => `/restaurants/${restaurantId}/items/${itemId}/recipes/${recipeId}/deactivate`,
    delete: (restaurantId: string, itemId: string, recipeId: string) => `/restaurants/${restaurantId}/items/${itemId}/recipes/${recipeId}`,
  },
  tables: {
    list: (restaurantId: string) => `/restaurants/${restaurantId}/tables`,
    create: (restaurantId: string) => `/restaurants/${restaurantId}/tables`,
    update: (restaurantId: string, tableId: string) => `/restaurants/${restaurantId}/tables/${tableId}`,
    copy: (restaurantId: string, tableId: string) => `/restaurants/${restaurantId}/tables/${tableId}/copy`,
    activate: (restaurantId: string, tableId: string) => `/restaurants/${restaurantId}/tables/${tableId}/activate`,
    deactivate: (restaurantId: string, tableId: string) => `/restaurants/${restaurantId}/tables/${tableId}/deactivate`,
    delete: (restaurantId: string, tableId: string) => `/restaurants/${restaurantId}/tables/${tableId}`,
  },
  tableSessions: {
    mine: (restaurantId: string) => `/restaurants/${restaurantId}/table-sessions/mine`,
    mineDetail: (restaurantId: string, sessionId: number) => `/restaurants/${restaurantId}/table-sessions/mine/${sessionId}`,
    closeReviews: (restaurantId: string) => `/restaurants/${restaurantId}/table-sessions/close-reviews`,
    continueService: (restaurantId: string, sessionId: number) =>
      `/restaurants/${restaurantId}/table-sessions/${sessionId}/continue-service`,
    orders: (restaurantId: string, sessionId: number) => `/restaurants/${restaurantId}/table-sessions/${sessionId}/orders`,
    orderDetail: (restaurantId: string, sessionId: number, orderId: number) =>
      `/restaurants/${restaurantId}/table-sessions/${sessionId}/orders/${orderId}`,
    sendOrderToKitchen: (restaurantId: string, sessionId: number, orderId: number) =>
      `/restaurants/${restaurantId}/table-sessions/${sessionId}/orders/${orderId}/send-to-kitchen`,
  },
  customerTableSessions: {
    mine: '/public/table-sessions/my',
    detail: (sessionId: number) => `/public/table-sessions/${sessionId}`,
    orders: (sessionId: number) => `/public/table-sessions/${sessionId}/orders`,
    orderDetail: (sessionId: number, orderId: number) => `/public/table-sessions/${sessionId}/orders/${orderId}`,
  },
  kitchen: {
    orders: (restaurantId: string) => `/restaurants/${restaurantId}/kitchen/orders`,
    orderAction: (restaurantId: string, orderId: number, action: KitchenProgressAction) =>
      `/restaurants/${restaurantId}/kitchen/orders/${orderId}/${action}`,
  },
  staff: {
    list: (restaurantId: string) => `/staff/${restaurantId}`,
    detail: (restaurantId: string, staffId: string) => `/staff/${restaurantId}/detail/${staffId}`,
    update: (restaurantId: string, staffId: string) => `/restaurants/${restaurantId}/staff/${staffId}`,
    activate: (restaurantId: string, staffId: string) => `/restaurants/${restaurantId}/staff/${staffId}/activate`,
    deactivate: (restaurantId: string, staffId: string) => `/restaurants/${restaurantId}/staff/${staffId}/deactivate`,
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
  userSessions: {
    list: '/user/sessions',
    revoke: (sessionId: string) => `/user/sessions/${encodeURIComponent(sessionId)}`,
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
  outbox: {
    list: '/admin/outbox/messages',
    detail: (messageId: string) => `/admin/outbox/messages/${messageId}`,
    retry: (messageId: string) => `/admin/outbox/messages/${messageId}/retry`,
  },
}
