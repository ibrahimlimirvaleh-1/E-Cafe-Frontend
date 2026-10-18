import { i18n } from '../../shared/i18n/i18n'
import { CreditCard, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { ecafeApi, type PaymentCapabilities, type ReservationPaymentSummary } from '../../shared/api/ecafeApi'
import { normalizeCaughtApiError } from '../../shared/api/httpClient'
import { useKeyedAsyncData } from '../../shared/hooks/useAsyncData'
import { paymentStatusLabel } from '../../shared/lib/paymentStatus'
import { Button } from '../../shared/ui/Button'
import { StatusMessage } from '../../shared/ui/StatusMessage'

type Props = {
  restaurantId: string
  reservationId: string
  amount?: string
}

type PaymentState = { capabilities: PaymentCapabilities | null; summary: ReservationPaymentSummary | null }

export function ManagerDepositPaymentPanel({ restaurantId, reservationId, amount }: Props) {
  const [revision, setRevision] = useState(0)
  const [isAuthorizing, setIsAuthorizing] = useState(false)
  const [feedback, setFeedback] = useState('')
  const { data, error, isLoading } = useKeyedAsyncData<PaymentState>(
    async () => {
      const [capabilities, summary] = await Promise.all([
        ecafeApi.reservationPayments.capabilities(),
        ecafeApi.reservationPayments.summary(reservationId),
      ])
      return { capabilities, summary }
    },
    { capabilities: null, summary: null },
    `${restaurantId}:${reservationId}`,
    [restaurantId, reservationId, revision],
  )

  async function authorize() {
    if (!data.capabilities?.enabled || !data.summary?.canAuthorize || isAuthorizing) return
    setFeedback('')
    setIsAuthorizing(true)
    try {
      await ecafeApi.reservationPayments.authorize(restaurantId, reservationId)
      setRevision((value) => value + 1)
      window.dispatchEvent(new Event('ecafe:notifications-refresh'))
    } catch (cause) {
      setFeedback(normalizeCaughtApiError(cause, 'Ödənişə icazə verilə bilmədi.').message)
    } finally {
      setIsAuthorizing(false)
    }
  }

  return (
    <section className="reservation-payment-panel" aria-label={i18n.t('ui.features.reservations.manager_deposit_payment_panel.depozit_odenisi_73ba88')}>
      <div className="reservation-payment-panel-header">
        <div className="reservation-payment-panel-icon"><CreditCard size={20} /></div>
        <div>
          <span className="section-eyebrow">{i18n.t('ui.features.reservations.manager_deposit_payment_panel.depozit_1af98c')}</span>
          <h2>{i18n.t('ui.features.reservations.manager_deposit_payment_panel.odenise_icaze_9af3d5')}</h2>
          <p>{i18n.t('ui.features.reservations.manager_deposit_payment_panel.musteri_depoziti_yalniz_sistemdeki_ode_fb6052')}</p>
        </div>
      </div>
      <div className="reservation-payment-meta">
        <span><strong>{i18n.t('ui.features.reservations.manager_deposit_payment_panel.rezervasiya_9cf147')}</strong><b>#{reservationId}</b></span>
        <span><strong>{i18n.t('ui.features.reservations.manager_deposit_payment_panel.depozit_4a14b8')}</strong><b>{amount || 'Serverdə yoxlanılır'}</b></span>
        <span><ShieldCheck size={16} /> {i18n.t('ui.features.reservations.manager_deposit_payment_panel.rekvizit_mubadilesi_yoxdur_21ebc1')}</span>
      </div>
      {isLoading ? <p role="status">{i18n.t('ui.features.reservations.manager_deposit_payment_panel.odenis_veziyyeti_yoxlanilir_f721f8')}</p> : null}
      {error ? <StatusMessage tone="danger" autoHideMs={false}>{error}</StatusMessage> : null}
      {data.capabilities && !data.capabilities.enabled ? (
        <StatusMessage tone="warning" autoHideMs={false}>{data.capabilities.message || 'Ödəniş xidməti hazırda aktiv deyil.'}</StatusMessage>
      ) : null}
      {data.capabilities?.enabled && data.capabilities.isTest ? (
        <StatusMessage tone="info" autoHideMs={false}>{i18n.t('ui.features.reservations.manager_deposit_payment_panel.test_rejimi_real_pul_kocurulmur_63faa1')}</StatusMessage>
      ) : null}
      {data.summary?.latestPayment ? <p className="reservation-payment-state">{i18n.t('ui.features.reservations.manager_deposit_payment_panel.son_odenis_2ea849')} {paymentStatusLabel(data.summary.latestPayment.statusId, data.summary.latestPayment.status)}</p> : null}
      {data.summary?.latestPayment?.isTest && !data.capabilities?.isTest ? <StatusMessage tone="info" autoHideMs={false}>{i18n.t('ui.features.reservations.manager_deposit_payment_panel.son_odenis_test_qeydi_idi_real_pul_tut_084205')}</StatusMessage> : null}
      {data.capabilities?.enabled && data.summary && !data.summary.enabled ? <p className="reservation-payment-state">{i18n.t('ui.features.reservations.manager_deposit_payment_panel.bu_rezervasiya_ucun_odenis_addimi_akti_7099cb')}</p> : null}
      {feedback ? <StatusMessage tone="danger" autoHideMs={false}>{feedback}</StatusMessage> : null}
      {data.capabilities?.enabled && data.summary?.canAuthorize ? (
        <div className="reservation-payment-actions">
          <span>{i18n.t('ui.features.reservations.manager_deposit_payment_panel.icaze_verildikden_sonra_musteri_odenis_07b291')}</span>
          <Button disabled={isAuthorizing} onClick={() => void authorize()} type="button">
            <CreditCard size={17} /> {isAuthorizing ?i18n.t('ui.features.reservations.manager_deposit_payment_panel.icaze_verilir_175238') :i18n.t('ui.features.reservations.manager_deposit_payment_panel.odenise_icaze_ver_691741')}
          </Button>
        </div>
      ) : null}
    </section>
  )
}
