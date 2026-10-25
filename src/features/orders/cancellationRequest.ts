import type { OrderCancellationRequestResponse } from '../../shared/api/ecafeApi'
import { i18n } from '../../shared/i18n/i18n'

export const cancellationRequestStatus = {
  awaitingWaiter: 1,
  pendingKitchen: 2,
  approved: 3,
  rejected: 4,
  expired: 5,
} as const

export function cancellationRequestLabel(request: OrderCancellationRequestResponse) {
  const status = request.statusId
  const key = status === cancellationRequestStatus.awaitingWaiter ? 'awaitingWaiter'
    : status === cancellationRequestStatus.pendingKitchen ? 'pendingKitchen'
      : status === cancellationRequestStatus.approved ? 'approved'
        : status === cancellationRequestStatus.rejected ? 'rejected' : 'expired'
  return i18n.t(`ui.cancellationRequest.status.${key}`)
}

export function hasCurrentCancellationRequest(server: OrderCancellationRequestResponse | null, confirmed: OrderCancellationRequestResponse | null) {
  if (!confirmed) return true
  if (!server) return false
  if (server.id !== confirmed.id || server.statusId >= cancellationRequestStatus.approved) return true
  if (confirmed.statusId >= cancellationRequestStatus.approved) return false
  return server.statusId >= confirmed.statusId
}
