import type { StatusTone } from '../../entities/types'
import { i18n } from '../i18n/i18n'

function statusLabel(normalized: string, original: string) {
  if (normalized.includes('awaitingpaymentinstruction') || normalized.includes('restoran cavabı')) return i18n.t('ui.status.restaurantResponse')
  if (normalized.includes('paymentsubmitted') || normalized.includes('çek göndərilib')) return i18n.t('ui.status.paymentSubmitted')
  if (normalized.includes('pendingpayment') || normalized.includes('ödəniş gözlənilir')) return i18n.t('ui.status.pendingPayment')
  if (normalized.includes('confirmed') || normalized.includes('təsdiqlənib')) return i18n.t('ui.status.confirmed')
  if (normalized.includes('seated') || normalized.includes('əyləşib')) return i18n.t('ui.status.seated')
  if (normalized.includes('completed') || normalized.includes('tamamlanıb')) return i18n.t('ui.status.completed')
  if (normalized.includes('expired') || normalized.includes('vaxtı bitib')) return i18n.t('ui.status.expired')
  if (normalized.includes('cancel') || normalized.includes('ləğv')) return i18n.t('ui.status.cancelled')
  if (normalized.includes('reject') || normalized.includes('rədd')) return i18n.t('ui.status.rejected')
  if (normalized.includes('noshow') || normalized.includes('gəlməyib')) return i18n.t('ui.status.noShow')
  return original
}

export function getReservationStatusPresentation(status: string): { label: string; tone: StatusTone } {
  const rawLabel = status?.trim() || 'Gözləmədə'
  const normalized = rawLabel.toLocaleLowerCase('az-AZ')
  const displayLabel = rawLabel === 'Gözləmədə' ? i18n.t('ui.status.pending') : statusLabel(normalized, rawLabel)

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

  if (normalized.includes('seated') || normalized.includes('əyləşib')) return { label: displayLabel, tone: 'success' }
  if (normalized.includes('completed') || normalized.includes('tamamlanıb')) return { label: displayLabel, tone: 'success' }
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

export function isReservationConfirmed(status: string) {
  const normalized = status.toLocaleLowerCase('az-AZ')
  return normalized.includes('confirmed') || normalized.includes('təsdiqlənib')
}

// Ayrılma səbəbini bütün rezervasiya görünüşlərində eyni mətnlə göstəririk.
export function getReservationDepartureReasonLabel(reason: 1 | 2 | null | undefined) {
  if (reason === 1) return i18n.t('ui.departure.restaurantCouldNotSeat')
  if (reason === 2) return i18n.t('ui.departure.guestLeft')
  return ''
}
