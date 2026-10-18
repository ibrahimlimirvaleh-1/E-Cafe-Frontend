import { i18n } from '../i18n/i18n'

export const orderStatusId = {
  created: 2001,
  accepted: 2002,
  preparing: 2003,
  ready: 2004,
  served: 2005,
  closed: 2006,
  cancelled: 2007,
  scheduled: 2008,
} as const

// Mətbəxə göndərilmə ayrıca vaxtla işarələnir; Created statusu qəbul demək deyil.
export function orderKitchenLabel(statusId: number, sentToKitchenAt: string | null) {
  if (statusId === orderStatusId.created) return i18n.t(sentToKitchenAt ? 'ui.orderStatus.awaitingKitchen' : 'ui.orderStatus.notSent')
  if (statusId === orderStatusId.accepted) return i18n.t('ui.orderStatus.accepted')
  if (statusId === orderStatusId.preparing) return i18n.t('ui.orderStatus.preparing')
  if (statusId === orderStatusId.ready) return i18n.t('ui.orderStatus.ready')
  if (statusId === orderStatusId.served) return i18n.t('ui.orderStatus.served')
  if (statusId === orderStatusId.closed) return i18n.t('ui.orderStatus.closed')
  if (statusId === orderStatusId.cancelled) return i18n.t('ui.orderStatus.cancelled')
  if (statusId === orderStatusId.scheduled) return i18n.t('ui.orderStatus.scheduled')
  return i18n.t('ui.orderStatus.updated')
}
