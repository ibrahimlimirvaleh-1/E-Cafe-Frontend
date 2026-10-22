import { ecafeApi } from '../../shared/api/ecafeApi'
import { orderStatusId } from '../../shared/lib/orderStatus'

export async function serveWaiterOrder(restaurantId: string, sessionId: number, orderId: number) {
  const updated = await ecafeApi.tableSessions.serveOrder(restaurantId, sessionId, orderId)
  if (updated.id !== orderId || updated.restaurantId !== Number(restaurantId) || updated.tableSessionId !== sessionId ||
    updated.statusId !== orderStatusId.served || !updated.servedAt) {
    throw new Error('Təqdimetmə cavabı təsdiqlənmədi.')
  }
  return updated
}
