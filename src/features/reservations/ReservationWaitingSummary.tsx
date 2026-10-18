import { i18n } from '../../shared/i18n/i18n'
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
    return <section className="reservation-waiting-summary is-review" aria-label={i18n.t('ui.features.reservations.reservation_waiting_summary.gelis_neticesi_yoxlanmalidir_a0a78d')} id="waiting">
      <div className="reservation-waiting-heading"><ClipboardCheck size={19} aria-hidden="true" /><strong>{i18n.t('ui.features.reservations.reservation_waiting_summary.netice_yoxlanmalidir_af3e9d')}</strong></div>
      <p>{viewer === 'manager'
        ?i18n.t('ui.features.reservations.reservation_waiting_summary.qonagin_gelisi_qeyde_alinib_amma_xidme_44ef15')
        :i18n.t('ui.features.reservations.reservation_waiting_summary.gelisiniz_qeyde_alinib_xidmet_muddeti__9c43e7')}</p>
    </section>
  }
  if (!waiting) return null

  return <section className={`reservation-waiting-summary${waiting.isOverdue ? ' is-overdue' : ''}`} aria-label={i18n.t('ui.features.reservations.reservation_waiting_summary.masa_gozleme_veziyyeti_683238')} id="waiting">
    <div className="reservation-waiting-heading">
      <Clock3 size={19} aria-hidden="true" />
      <strong>{viewer === 'customer' ?i18n.t('ui.features.reservations.reservation_waiting_summary.gelisiniz_qeyde_alinib_masa_gozlenilir_d37df8') :i18n.t('ui.features.reservations.reservation_waiting_summary.musteri_gelib_masa_gozleyir_a8ba66')}</strong>
      {waiting.isOverdue ? <span className="reservation-waiting-alert">{viewer === 'customer' ?i18n.t('ui.features.reservations.reservation_waiting_summary.masa_hazirligi_gecikir_7c2918') :i18n.t('ui.features.reservations.reservation_waiting_summary.servis_gecikir_be3878')}</span> : null}
    </div>
    <dl>
      <div><dt>{i18n.t('ui.features.reservations.reservation_waiting_summary.gelis_qeydi_3ce768')}</dt><dd>{formatReservationDateTime(waiting.waitingSinceAt, timeZone || undefined)}</dd></div>
      <div><dt>{i18n.t('ui.features.reservations.reservation_waiting_summary.gozleme_1ab81e')}</dt><dd>{i18n.t('ui.count.minutes', { count: waiting.waitingMinutes })}</dd></div>
      <div><dt>{i18n.t('ui.features.reservations.reservation_waiting_summary.servis_gecikmesi_f86cc5')}</dt><dd>{i18n.t('ui.count.minutes', { count: waiting.serviceDelayMinutes })}</dd></div>
    </dl>
  </section>
}
