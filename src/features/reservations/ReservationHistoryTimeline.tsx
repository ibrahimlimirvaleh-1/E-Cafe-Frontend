import { Check, CircleAlert, Clock3, ShieldCheck, Store, UserRound } from 'lucide-react'
import type { ReservationHistoryItem } from '../../shared/api/ecafeApi'
import { formatReservationDateTime } from '../../shared/lib/dateFormatting'
import { getReservationStatusPresentation } from '../../shared/lib/reservationStatus'

type ReservationHistoryTimelineProps = {
  items: ReservationHistoryItem[]
  viewer?: 'customer' | 'manager'
  currentStatus?: string
}

function actorLabel(actorType: ReservationHistoryItem['actorType'], viewer: 'customer' | 'manager') {
  if (actorType === 'Customer') return viewer === 'customer' ? 'Siz' : 'Müştəri'
  if (actorType === 'Restaurant') return 'Restoran'
  return 'Sistem'
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

function customerReason(reason: string) {
  if (reason === 'Müştəri check-in etdi və masa sessiyası açıldı.' || reason === 'Müştəri masaya əyləşdi və masa açıldı.') {
    return 'Restoran gəlişinizi təsdiqlədi və masanız açıldı.'
  }
  if (reason === 'Müştəri no-show müddəti ərzində check-in etmədi.' || reason === 'Müştəri gəliş üçün ayrılan vaxtda masaya əyləşmədi.') {
    return 'Gəliş üçün ayrılan vaxtda masaya əyləşmədiniz.'
  }
  return reason
}

function eventLabel(item: ReservationHistoryItem) {
  const status = item.toStatus.toLocaleLowerCase('az-AZ')
  const previous = item.fromStatus?.toLocaleLowerCase('az-AZ') || ''

  if (!item.fromStatus && item.reason === 'Mövcud rezervasiyanın ilkin statusu.') return 'İlkin vəziyyət qeydə alındı'
  if (!item.fromStatus) return 'Rezervasiya yaradıldı'
  if (status.includes('awaitingpaymentinstruction') || status.includes('restoran cavabı')) return 'Restoran cavabı gözlənilir'
  if (status.includes('pendingpayment') || status.includes('ödəniş gözlənilir')) {
    return previous.includes('paymentsubmitted') || previous.includes('çek göndərilib')
      ? 'Ödəniş çeki rədd edildi'
      : 'Ödəniş məlumatı göndərildi'
  }
  if (status.includes('paymentsubmitted') || status.includes('çek göndərilib')) return 'Ödəniş çeki göndərildi'
  if (status.includes('confirmed') || status.includes('təsdiqlənib')) return 'Rezervasiya təsdiqləndi'
  if (status.includes('seated') || status.includes('əyləşib')) return 'Müştəri masa arxasında əyləşdi'
  if (status.includes('completed') || status.includes('tamamlanıb')) return 'Rezervasiya tamamlandı'
  if (status.includes('cancel') || status.includes('ləğv')) return 'Rezervasiya ləğv edildi'
  if (status.includes('reject') || status.includes('rədd')) return 'Rezervasiya rədd edildi'
  if (status.includes('noshow') || status.includes('gəlməyib')) return 'Müştəri gəlmədi'
  if (status.includes('expired') || status.includes('vaxtı bitib')) return 'Rezervasiyanın vaxtı bitdi'
  return getReservationStatusPresentation(item.toStatus).label
}

export function ReservationHistoryTimeline({ items, viewer = 'customer', currentStatus }: ReservationHistoryTimelineProps) {
  const lastEvent = items[items.length - 1]
  const currentPresentation = getReservationStatusPresentation(currentStatus || lastEvent?.toStatus || '')

  return (
    <section className="reservation-history-panel" aria-label="Rezervasiya tarixçəsi">
      <div className="reservation-history-heading">
        <Clock3 size={19} aria-hidden="true" />
        <div>
          <span className="section-eyebrow">Proses</span>
          <h2>Rezervasiya tarixçəsi</h2>
        </div>
      </div>

      {viewer === 'manager' && lastEvent ? (
        <div className="reservation-history-summary">
          <div>
            <span className="section-eyebrow">CARİ VƏZİYYƏT</span>
            <strong>{currentPresentation.label}</strong>
          </div>
          <span>Son yenilənmə: <time dateTime={lastEvent.changedAt}>{formatReservationDateTime(lastEvent.changedAt)}</time></span>
        </div>
      ) : null}

      {items.length === 0 ? (
        <p className="reservation-history-empty">Bu rezervasiya üçün hələ tarixçə yoxdur.</p>
      ) : (
        <div className="reservation-history-events" role="region" aria-label="Tarixçə hadisələri" tabIndex={0}>
          {viewer === 'manager' ? <h3>Hadisələr</h3> : null}
          <ol className="reservation-history-timeline">
            {items.map((item, index) => {
              const presentation = getReservationStatusPresentation(item.toStatus)
              const isCurrent = index === items.length - 1
              const reason = item.reason?.trim()

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
                      <strong>{viewer === 'manager' ? eventLabel(item) : presentation.label}</strong>
                      {viewer === 'customer' && isCurrent ? <span className="reservation-history-current">Hazırkı mərhələ</span> : null}
                    </div>
                    <div className="reservation-history-meta">
                      <time dateTime={item.changedAt}>{formatReservationDateTime(item.changedAt)}</time>
                      <span><ActorIcon actorType={item.actorType} />{actorLabel(item.actorType, viewer)}</span>
                    </div>
                    {reason && reason !== presentation.label && (viewer === 'customer' || !routineReasons.has(reason))
                      ? <p>{viewer === 'manager' ? `Qeyd: ${reason}` : customerReason(reason)}</p>
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
