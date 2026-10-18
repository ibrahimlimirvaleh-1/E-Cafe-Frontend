import { i18n } from '../i18n/i18n'

// Mirrors StatusIds.Build(PaymentStatus, value) from the backend.
export const paymentStatusId = {
  pending: 3001,
  paid: 3002,
  failed: 3003,
  cancelled: 3004,
  refunded: 3005,
} as const

export const refundStatusId = {
  processing: 8004,
} as const

const paymentStatusKeys: Record<number, string> = {
  [paymentStatusId.pending]: 'ui.payment.pending',
  [paymentStatusId.paid]: 'ui.payment.paid',
  [paymentStatusId.failed]: 'ui.payment.failed',
  [paymentStatusId.cancelled]: 'ui.payment.cancelled',
  [paymentStatusId.refunded]: 'ui.payment.refunded',
}

export function paymentStatusLabel(statusId: number, status: string) {
  const key = paymentStatusKeys[statusId]
  return key ? i18n.t(key) : status
}
