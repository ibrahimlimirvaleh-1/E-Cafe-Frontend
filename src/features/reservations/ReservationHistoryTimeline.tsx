import { Check, CircleAlert, Clock3, ShieldCheck, Store, UserRound } from 'lucide-react'
import type { ReservationHistoryItem } from '../../shared/api/ecafeApi'
import { formatReservationDateTime } from '../../shared/lib/dateFormatting'
import { getReservationStatusPresentation } from '../../shared/lib/reservationStatus'

type ReservationHistoryTimelineProps = {
  items: ReservationHistoryItem[]
}

function actorLabel(actorType: ReservationHistoryItem['actorType']) {
  if (actorType === 'Customer') return 'Siz'
  if (actorType === 'Restaurant') return 'Restoran'
  return 'Sistem'
}

function ActorIcon({ actorType }: { actorType: ReservationHistoryItem['actorType'] }) {
  if (actorType === 'Customer') return <UserRound size={15} aria-hidden="true" />
  if (actorType === 'Restaurant') return <Store size={15} aria-hidden="true" />
  return <ShieldCheck size={15} aria-hidden="true" />
}

export function ReservationHistoryTimeline({ items }: ReservationHistoryTimelineProps) {
  return (
    <section className="reservation-history-panel" aria-label="Rezervasiya tarixçəsi">
      <div className="reservation-history-heading">
        <Clock3 size={19} aria-hidden="true" />
        <div>
          <span className="section-eyebrow">Proses</span>
          <h2>Rezervasiya tarixçəsi</h2>
        </div>
      </div>

      {items.length === 0 ? (
        <p className="reservation-history-empty">Bu rezervasiya üçün hələ tarixçə yoxdur.</p>
      ) : (
        <ol className="reservation-history-timeline">
          {items.map((item, index) => {
            const presentation = getReservationStatusPresentation(item.toStatus)
            const isCurrent = index === items.length - 1

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
                    <strong>{presentation.label}</strong>
                    {isCurrent ? <span className="reservation-history-current">Hazırkı mərhələ</span> : null}
                  </div>
                  <div className="reservation-history-meta">
                    <time dateTime={item.changedAt}>{formatReservationDateTime(item.changedAt)}</time>
                    <span><ActorIcon actorType={item.actorType} />{actorLabel(item.actorType)}</span>
                  </div>
                  {item.reason && item.reason !== presentation.label ? <p>{item.reason}</p> : null}
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}
