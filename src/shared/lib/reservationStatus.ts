export function isReservationAwaitingPayment(status: string) {
  const normalized = status.toLocaleLowerCase('az-AZ')

  return normalized.includes('pending') || normalized.includes('ödəniş gözlənilir')
}
