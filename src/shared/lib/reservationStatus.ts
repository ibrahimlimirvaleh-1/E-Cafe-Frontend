import type { StatusTone } from '../../entities/types'

export function getReservationStatusPresentation(status: string): { label: string; tone: StatusTone } {
  const displayLabel = status?.trim() || 'Gözləmədə'
  const normalized = displayLabel.toLocaleLowerCase('az-AZ')

  if (normalized.includes('awaitingpaymentinstruction') || normalized.includes('restoran cavabı')) {
    return { label: displayLabel, tone: 'warning' }
  }

  if (normalized.includes('paymentsubmitted') || normalized.includes('çek') || normalized.includes('çek göndərilib')) {
    return { label: displayLabel, tone: 'info' }
  }

  if (normalized.includes('pendingpayment') || normalized.includes('pending') || normalized.includes('ödəniş gözlənilir')) {
    return { label: displayLabel, tone: 'warning' }
  }

  if (normalized.includes('confirmed') || normalized.includes('təsdiqlənib')) {
    return { label: displayLabel, tone: 'success' }
  }

  if (normalized.includes('seated')) return { label: displayLabel, tone: 'success' }
  if (normalized.includes('completed')) return { label: displayLabel, tone: 'success' }
  if (normalized.includes('expired') || normalized.includes('vaxtı bitib')) {
    return { label: displayLabel, tone: 'danger' }
  }

  if (normalized.includes('cancel') || normalized.includes('ləğv')) {
    return { label: displayLabel, tone: 'danger' }
  }

  if (normalized.includes('reject') || normalized.includes('rədd')) {
    return { label: displayLabel, tone: 'danger' }
  }

  if (normalized.includes('noshow') || normalized.includes('gəlməyib')) {
    return { label: displayLabel, tone: 'danger' }
  }

  return { label: displayLabel, tone: 'neutral' }
}

export function isReservationAwaitingPayment(status: string) {
  const normalized = status.toLocaleLowerCase('az-AZ')

  return normalized.includes('pending') || normalized.includes('ödəniş gözlənilir')
}
