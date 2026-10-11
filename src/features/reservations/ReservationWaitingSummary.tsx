import { ClipboardCheck, Clock3 } from 'lucide-react'
import type { ReservationWaitingInfo } from '../../shared/api/ecafeApi'
import { formatReservationDateTime } from '../../shared/lib/dateFormatting'
import './reservation-waiting.css'

type Props = {
  waiting?: ReservationWaitingInfo | null
  requiresReceptionReview?: boolean
  timeZone?: string | null
  viewer: 'customer' | 'manager'
}

export function ReservationWaitingSummary({ waiting, requiresReceptionReview, timeZone, viewer }: Props) {
  if (requiresReceptionReview) {
    return <section className="reservation-waiting-summary is-review" aria-label="Gəliş nəticəsi yoxlanmalıdır" id="waiting">
      <div className="reservation-waiting-heading"><ClipboardCheck size={19} aria-hidden="true" /><strong>Nəticə yoxlanmalıdır</strong></div>
      <p>{viewer === 'manager'
        ? 'Qonağın gəlişi qeydə alınıb, amma xidmət müddəti bitib. Masaya əyləşmə və ayrılma nəticəsini faktiki vəziyyətə əsasən yoxlayın.'
        : 'Gəlişiniz qeydə alınıb. Xidmət müddəti bitdiyi üçün restoran nəticəni yoxlayır. Rezervasiyanız avtomatik ləğv edilməyib.'}</p>
    </section>
  }
  if (!waiting) return null

  return <section className={`reservation-waiting-summary${waiting.isOverdue ? ' is-overdue' : ''}`} aria-label="Masa gözləmə vəziyyəti" id="waiting">
    <div className="reservation-waiting-heading">
      <Clock3 size={19} aria-hidden="true" />
      <strong>{viewer === 'customer' ? 'Gəlişiniz qeydə alınıb, masa gözlənilir' : 'Müştəri gəlib, masa gözləyir'}</strong>
      {waiting.isOverdue ? <span className="reservation-waiting-alert">{viewer === 'customer' ? 'Masa hazırlığı gecikir' : 'Servis gecikir'}</span> : null}
    </div>
    <dl>
      <div><dt>Gəliş qeydi</dt><dd>{formatReservationDateTime(waiting.waitingSinceAt, timeZone || undefined)}</dd></div>
      <div><dt>Gözləmə</dt><dd>{waiting.waitingMinutes} dəq</dd></div>
      <div><dt>Servis gecikməsi</dt><dd>{waiting.serviceDelayMinutes} dəq</dd></div>
    </dl>
  </section>
}
