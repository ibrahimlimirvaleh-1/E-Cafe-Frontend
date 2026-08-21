import { HubConnectionBuilder, LogLevel } from '@microsoft/signalr'
import { getApiOrigin } from '../api/httpClient'
import { getAccessToken } from '../auth/tokenStorage'

type UserSessionEventsOptions = {
  onUserDeactivated: (message: string) => void
}

type UserDeactivatedPayload = {
  message?: string
}

const USER_EVENTS_HUB_PATH = '/hubs/user-events'
const USER_DEACTIVATED_EVENT = 'UserDeactivated'
const DEFAULT_DEACTIVATION_MESSAGE = 'Hesabınız deaktiv edilib. Sistemə girişiniz dayandırıldı.'

export function createUserSessionEventsConnection({ onUserDeactivated }: UserSessionEventsOptions) {
  const connection = new HubConnectionBuilder()
    .withUrl(`${getApiOrigin()}${USER_EVENTS_HUB_PATH}`, {
      accessTokenFactory: () => getAccessToken() ?? '',
    })
    .withAutomaticReconnect()
    .configureLogging(import.meta.env.DEV ? LogLevel.Information : LogLevel.Warning)
    .build()

  connection.on(USER_DEACTIVATED_EVENT, (payload?: UserDeactivatedPayload) => {
    onUserDeactivated(payload?.message?.trim() || DEFAULT_DEACTIVATION_MESSAGE)
  })

  return connection
}
