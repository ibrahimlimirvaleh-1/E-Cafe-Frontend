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
  if (statusId === orderStatusId.created) return sentToKitchenAt ? 'Mətbəxdə gözləyir' : 'Mətbəxə göndərilməyib'
  if (statusId === orderStatusId.accepted) return 'Qəbul edilib'
  if (statusId === orderStatusId.preparing) return 'Hazırlanır'
  if (statusId === orderStatusId.ready) return 'Hazırdır'
  if (statusId === orderStatusId.served) return 'Təqdim olunub'
  if (statusId === orderStatusId.closed) return 'Bağlanıb'
  if (statusId === orderStatusId.cancelled) return 'Ləğv edilib'
  if (statusId === orderStatusId.scheduled) return 'Planlaşdırılıb'
  return 'Status yenilənib'
}
