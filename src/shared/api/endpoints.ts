export const endpoints = {
  auth: {
    login: '/user/login',
    register: '/user/register',
  },
  restaurants: {
    adminList: '/restaurants/getAll',
    publicList: '/public/restaurants',
    publicDetail: (restaurantId: string) => `/public/restaurants/${restaurantId}`,
  },
  contracts: {
    list: (restaurantId: string) => `/restaurants/${restaurantId}/contracts`,
    active: (restaurantId: string) => `/restaurants/${restaurantId}/contracts/active`,
    sendForSignature: (restaurantId: string, contractId: string) =>
      `/restaurants/${restaurantId}/contracts/${contractId}/send-for-signature`,
    approve: (restaurantId: string, contractId: string) => `/restaurants/${restaurantId}/contracts/${contractId}/approve`,
    activate: (restaurantId: string, contractId: string) => `/restaurants/${restaurantId}/contracts/${contractId}/activate`,
    terminate: (restaurantId: string, contractId: string) => `/restaurants/${restaurantId}/contracts/${contractId}/terminate`,
  },
  publicRestaurant: {
    menu: (restaurantId: string) => `/public/restaurants/${restaurantId}/menu`,
    staff: (restaurantId: string) => `/public/restaurants/${restaurantId}/staff`,
    tables: (restaurantId: string) => `/public/restaurants/${restaurantId}/tables`,
  },
  menu: {
    categories: (restaurantId: string) => `/category/${restaurantId}`,
    items: '/items/getAll',
  },
}
