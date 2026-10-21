import { i18n } from '../../shared/i18n/i18n'
import { useTranslation } from 'react-i18next'
import { Check, CircleAlert, Clock3, ShieldCheck, Store, UserRound } from 'lucide-react'
import type { ReservationHistoryItem } from '../../shared/api/ecafeApi'
import { formatReservationDateTime } from '../../shared/lib/dateFormatting'
import { getReservationStatusPresentation } from '../../shared/lib/reservationStatus'

type ReservationHistoryTimelineProps = {
  items: ReservationHistoryItem[]
  viewer?: 'customer' | 'manager'
  currentStatus?: string
  arrivedAt?: string | null
  seatedAt?: string | null
  requiresReceptionReview?: boolean
  timeZone?: string
}

type TimelineEvent =
  | { kind: 'status'; item: ReservationHistoryItem; changedAt: string }
  | { kind: 'arrival'; changedAt: string }

function actorLabel(actorType: ReservationHistoryItem['actorType'], viewer: 'customer' | 'manager') {
  if (actorType === 'Customer') return i18n.t(viewer === 'customer' ? 'ui.history.actor.you' : 'ui.history.actor.customer')
  if (actorType === 'Restaurant') return i18n.t('ui.history.actor.restaurant')
  return i18n.t('ui.history.actor.system')
}

function ActorIcon({ actorType }: { actorType: ReservationHistoryItem['actorType'] }) {
  if (actorType === 'Customer') return <UserRound size={15} aria-hidden="true" />
  if (actorType === 'Restaurant') return <Store size={15} aria-hidden="true" />
  return <ShieldCheck size={15} aria-hidden="true" />
}

const routineReasons = new Set([
  'Rezervasiya yaradıldı.',
  'Mövcud rezervasiyanın ilkin statusu.',
  'Restoran ödəniş məlumatlarını göndərməyə başladı.',
  'Müştəri ödəniş çekini göndərdi.',
  'Ödəniş çeki təsdiqləndi.',
  'Müştəri check-in etdi və masa sessiyası açıldı.',
  'Müştəri masaya əyləşdi və masa açıldı.',
  'Masa sessiyası bağlandı, rezervasiya tamamlandı.',
])

const reasonKeys: Record<string, string> = {
  'Rezervasiya yaradıldı.': 'createdReason',
  'Mövcud rezervasiyanın ilkin statusu.': 'initialReason',
  'Restoran ödəniş məlumatlarını göndərməyə başladı.': 'paymentInstructionsReason',
  'Müştəri ödəniş çekini göndərdi.': 'receiptSentReason',
  'Ödəniş çeki təsdiqləndi.': 'receiptApprovedReason',
  'Müştəri check-in etdi və masa sessiyası açıldı.': 'arrivedReason',
  'Müştəri masaya əyləşdi və masa açıldı.': 'arrivedReason',
  'Masa sessiyası bağlandı, rezervasiya tamamlandı.': 'sessionClosedReason',
  'Müştəri no-show müddəti ərzində check-in etmədi.': 'noShowReason',
  'Müştəri gəliş üçün ayrılan vaxtda masaya əyləşmədi.': 'noShowReason',
}

function customerReason(reason: string) {
  const key = reasonKeys[reason]
  return key ? i18n.t(`ui.history.${key}`) : reason
}

function eventLabel(item: ReservationHistoryItem) {
  const status = item.toStatus.toLocaleLowerCase('az-AZ')
  const previous = item.fromStatus?.toLocaleLowerCase('az-AZ') || ''
  if (status === previous && item.reason === 'Müştəri yeni gəliş və masanın təhvil şərtlərini qəbul etdi.') return i18n.t('ui.history.arrivalUpdated')
  if (status === previous &&
    (item.reason?.startsWith('Masa dəyişdirildi:') || item.reason?.startsWith('Rezervasiyanın masası dəyişdirildi:')))
    return i18n.t('ui.history.tableChanged')

  if (!item.fromStatus && item.reason === 'Mövcud rezervasiyanın ilkin statusu.') return i18n.t('ui.history.initialEvent')
  if (!item.fromStatus) return i18n.t('ui.history.createdEvent')
  if (status.includes('awaitingpaymentinstruction') || status.includes('restoran cavabı')) return i18n.t('ui.history.awaitingRestaurant')
  if (status.includes('pendingpayment') || status.includes('ödəniş gözlənilir')) {
    return previous.includes('paymentsubmitted') || previous.includes('çek göndərilib')
      ? i18n.t('ui.history.receiptRejected')
      : i18n.t('ui.history.awaitingDeposit')
  }
  if (status.includes('paymentsubmitted') || status.includes('çek göndərilib')) return i18n.t('ui.history.receiptSent')
  if (status.includes('confirmed') || status.includes('təsdiqlənib')) return i18n.t('ui.history.confirmed')
  if (status.includes('seated') || status.includes('əyləşib')) return i18n.t('ui.history.seated')
  if (status.includes('completed') || status.includes('tamamlanıb')) return i18n.t('ui.history.completed')
  if (status.includes('cancel') || status.includes('ləğv')) return i18n.t('ui.history.cancelled')
  if (status.includes('reject') || status.includes('rədd')) return i18n.t('ui.history.rejected')
  if (status.includes('noshow') || status.includes('gəlməyib')) return i18n.t('ui.history.noShow')
  if (status.includes('expired') || status.includes('vaxtı bitib')) return i18n.t('ui.history.expired')
  return getReservationStatusPresentation(item.toStatus).label
}

export function ReservationHistoryTimeline({ items, viewer = 'customer', currentStatus, arrivedAt, seatedAt, requiresReceptionReview, timeZone }: ReservationHistoryTimelineProps) {
  useTranslation()
  const events: TimelineEvent[] = items.map((item) => ({ kind: 'status', item, changedAt: item.changedAt }))
  if (arrivedAt && (!seatedAt || new Date(arrivedAt).getTime() !== new Date(seatedAt).getTime())) {
    events.push({ kind: 'arrival', changedAt: arrivedAt })
  }
  events.sort((left, right) => new Date(left.changedAt).getTime() - new Date(right.changedAt).getTime())
  const lastEvent = events[events.length - 1]
  const currentPresentation = getReservationStatusPresentation(currentStatus || items[items.length - 1]?.toStatus || '')

  return (
    <section className="reservation-history-panel" aria-label={i18n.t('ui.features.reservations.reservation_history_timeline.rezervasiya_tarixcesi_9a2c1c')}>
      <div className="reservation-history-heading">
        <Clock3 size={19} aria-hidden="true" />
        <div>
          <span className="section-eyebrow">{i18n.t('ui.features.reservations.reservation_history_timeline.proses_329cb5')}</span>
          <h2>{i18n.t('ui.features.reservations.reservation_history_timeline.rezervasiya_tarixcesi_9a2c1c')}</h2>
        </div>
      </div>

      {viewer === 'manager' && lastEvent ? (
        <div className="reservation-history-summary">
          <div>
            <span className="section-eyebrow">{i18n.t('ui.features.reservations.reservation_history_timeline.cari_veziyyet_8ecc48')}</span>
            <strong>{requiresReceptionReview ?i18n.t('ui.features.reservations.reservation_history_timeline.netice_yoxlanmalidir_af3e9d') : currentPresentation.label}</strong>
          </div>
          <span>{requiresReceptionReview ?i18n.t('ui.features.reservations.reservation_history_timeline.son_hadise_c5e4dc') :i18n.t('ui.features.reservations.reservation_history_timeline.son_yenilenme_5994c9')}: <time dateTime={lastEvent.changedAt}>{formatReservationDateTime(lastEvent.changedAt, timeZone)}</time></span>
        </div>
      ) : null}

      {events.length === 0 ? (
        <p className="reservation-history-empty">{i18n.t('ui.features.reservations.reservation_history_timeline.bu_rezervasiya_ucun_hele_tarixce_yoxdu_c68b76')}</p>
      ) : (
        <div className="reservation-history-events" role="region" aria-label={i18n.t('ui.features.reservations.reservation_history_timeline.tarixce_hadiseleri_397b21')} tabIndex={0}>
          {viewer === 'manager' ? <h3>{i18n.t('ui.features.reservations.reservation_history_timeline.hadiseler_a4157c')}</h3> : null}
          <ol className="reservation-history-timeline">
            {events.map((event, index) => {
              const isCurrent = index === events.length - 1
              if (event.kind === 'arrival') {
                return <li className={`reservation-history-item reservation-history-item-success${isCurrent ? ' is-current' : ''}`} key={`arrival-${event.changedAt}`}>
                  <span className="reservation-history-marker" aria-hidden="true"><Check size={16} /></span>
                  <div className="reservation-history-content">
                    <div className="reservation-history-title-row"><strong>{i18n.t('ui.features.reservations.reservation_history_timeline.musteri_restorana_geldi_515f7f')}</strong>{viewer === 'customer' && isCurrent ? <span className="reservation-history-current">{requiresReceptionReview ?i18n.t('ui.features.reservations.reservation_history_timeline.son_qeyd_dc58de') :i18n.t('ui.features.reservations.reservation_history_timeline.hazirki_merhele_1977da')}</span> : null}</div>
                    <div className="reservation-history-meta"><time dateTime={event.changedAt}>{formatReservationDateTime(event.changedAt, timeZone)}</time><span><Store size={15} aria-hidden="true" />{i18n.t('ui.features.reservations.reservation_history_timeline.restoran_c4df56')}</span></div>
                    {viewer === 'customer' ? <p>{i18n.t('ui.features.reservations.reservation_history_timeline.gelisiniz_qeyde_alindi_masa_hele_acilm_7d968a')}</p> : null}
                  </div>
                </li>
              }
              const { item } = event
              const presentation = getReservationStatusPresentation(item.toStatus)
              const reason = item.reason?.trim()
              const displayReason = item.reasonLabel?.trim() || (reason && viewer === 'customer' ? customerReason(reason) : reason || '')

              return (
                <li
                  className={`reservation-history-item reservation-history-item-${presentation.tone}${isCurrent ? ' is-current' : ''}`}
                  key={item.id}
                >
                  <span className="reservation-history-marker" aria-hidden="true">
                    {presentation.tone === 'danger' ? <CircleAlert size={16} /> : <Check size={16} />}
                  </span>
                  <div className="reservation-history-content">
                    <div className="reservation-history-title-row">
                      <strong>{viewer === 'manager' || item.fromStatus === item.toStatus ? eventLabel(item) : presentation.label}</strong>
                      {viewer === 'customer' && isCurrent ? <span className="reservation-history-current">{requiresReceptionReview ?i18n.t('ui.features.reservations.reservation_history_timeline.son_qeyd_dc58de') :i18n.t('ui.features.reservations.reservation_history_timeline.hazirki_merhele_1977da')}</span> : null}
                    </div>
                    <div className="reservation-history-meta">
                      <time dateTime={item.changedAt}>{formatReservationDateTime(item.changedAt, timeZone)}</time>
                      <span><ActorIcon actorType={item.actorType} />{actorLabel(item.actorType, viewer)}</span>
                    </div>
                    {displayReason && displayReason !== presentation.label && (viewer === 'customer' || !routineReasons.has(reason || ''))
                      ? <p>{viewer === 'manager' ? i18n.t('ui.history.note', { reason: displayReason }) : displayReason}</p>
                      : null}
                  </div>
                </li>
              )
            })}
          </ol>
        </div>
      )}
    </section>
  )
}
