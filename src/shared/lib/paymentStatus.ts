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

const paymentStatusLabels: Record<number, string> = {
  [paymentStatusId.pending]: 'Ödəniş gözlənilir',
  [paymentStatusId.paid]: 'Ödəniş tamamlanıb',
  [paymentStatusId.failed]: 'Ödəniş uğursuz olub',
  [paymentStatusId.cancelled]: 'Ödəniş ləğv edilib',
  [paymentStatusId.refunded]: 'Ödəniş geri qaytarılıb',
}

export function paymentStatusLabel(statusId: number, status: string) {
  return paymentStatusLabels[statusId] || status
}
