import { HubConnectionBuilder, LogLevel } from '@microsoft/signalr'
import { getApiOrigin } from '../api/httpClient'
import { getAccessToken } from '../auth/tokenStorage'

type UserSessionEventsOptions = {
  onUserDeactivated: (message: string) => void
  onUserRoleChanged: (message: string) => void
  onRestaurantAccessChanged: (payload: RestaurantAccessChangedPayload) => void
}

type UserEventPayload = {
  message?: string
}

export type RestaurantAccessChangedPayload = {
  restaurantId?: number
  reason?: string
  message?: string
}

const USER_EVENTS_HUB_PATH = '/hubs/user-events'
const USER_DEACTIVATED_EVENT = 'UserDeactivated'
const USER_ROLE_CHANGED_EVENT = 'UserRoleChanged'
const RESTAURANT_ACCESS_CHANGED_EVENT = 'RestaurantAccessChanged'
const DEFAULT_DEACTIVATION_MESSAGE = 'Hesabınız deaktiv edilib. Sistemə girişiniz dayandırıldı.'
const DEFAULT_ROLE_CHANGED_MESSAGE = 'Rolunuz dəyişdirildi. Sessiya məlumatları yenilənir.'
const DEFAULT_RESTAURANT_ACCESS_CHANGED_MESSAGE = 'Restoran üzrə icazələr yeniləndi. Səhifə yenilənir.'

export function createUserSessionEventsConnection({
  onUserDeactivated,
  onUserRoleChanged,
  onRestaurantAccessChanged,
}: UserSessionEventsOptions) {
  const connection = new HubConnectionBuilder()
    .withUrl(`${getApiOrigin()}${USER_EVENTS_HUB_PATH}`, {
      accessTokenFactory: () => getAccessToken() ?? '',
    })
    .withAutomaticReconnect()
    .configureLogging(import.meta.env.DEV ? LogLevel.Information : LogLevel.Warning)
    .build()

  connection.on(USER_DEACTIVATED_EVENT, (payload?: UserEventPayload) => {
    onUserDeactivated(payload?.message?.trim() || DEFAULT_DEACTIVATION_MESSAGE)
  })

  connection.on(USER_ROLE_CHANGED_EVENT, (payload?: UserEventPayload) => {
    onUserRoleChanged(payload?.message?.trim() || DEFAULT_ROLE_CHANGED_MESSAGE)
  })

  connection.on(RESTAURANT_ACCESS_CHANGED_EVENT, (payload?: RestaurantAccessChangedPayload) => {
    onRestaurantAccessChanged({
      ...payload,
      message: payload?.message?.trim() || DEFAULT_RESTAURANT_ACCESS_CHANGED_MESSAGE,
    })
  })

  return connection
}
