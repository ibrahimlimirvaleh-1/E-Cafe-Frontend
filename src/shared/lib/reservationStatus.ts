import type { StatusTone } from '../../entities/types'

export function getReservationStatusPresentation(status: string): { label: string; tone: StatusTone } {
  const normalized = status.toLocaleLowerCase('az-AZ').trim()

  if (normalized.includes('awaitingpaymentinstruction') || normalized.includes('restoran cavabı')) {
    return { label: 'Restoran cavabı gözlənilir', tone: 'warning' }
  }

  if (normalized.includes('paymentsubmitted') || normalized.includes('çek') || normalized.includes('çek göndərilib')) {
    return { label: 'Çek yoxlanılır', tone: 'info' }
  }

  if (normalized.includes('pendingpayment') || normalized.includes('pending') || normalized.includes('ödəniş gözlənilir')) {
    return { label: 'Ödəniş gözləyir', tone: 'warning' }
  }

  if (normalized.includes('confirmed') || normalized.includes('təsdiqlənib')) {
    return { label: 'Təsdiqlənib', tone: 'success' }
  }

  if (normalized.includes('seated')) return { label: 'Müştəri oturub', tone: 'success' }
  if (normalized.includes('completed')) return { label: 'Tamamlanıb', tone: 'success' }
  if (normalized.includes('expired') || normalized.includes('vaxtı bitib')) {
    return { label: 'Vaxtı bitib', tone: 'danger' }
  }

  if (normalized.includes('cancel') || normalized.includes('ləğv')) {
    return { label: 'Ləğv edilib', tone: 'danger' }
  }

  if (normalized.includes('reject') || normalized.includes('rədd')) {
    return { label: 'Rədd edilib', tone: 'danger' }
  }

  if (normalized.includes('noshow') || normalized.includes('gəlməyib')) {
    return { label: 'Müştəri gəlməyib', tone: 'danger' }
  }

  return { label: status || 'Gözləmədə', tone: 'neutral' }
}

export function isReservationAwaitingPayment(status: string) {
  const normalized = status.toLocaleLowerCase('az-AZ')

  return normalized.includes('pending') || normalized.includes('ödəniş gözlənilir')
}
