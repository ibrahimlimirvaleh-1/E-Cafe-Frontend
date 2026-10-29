import { i18n } from '../../shared/i18n/i18n'
import { Check, Clock3, X } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { ecafeApi, type ReservationArrivalOffer, type ReservationArrivalOptions, type ReservationResponse } from '../../shared/api/ecafeApi'
import { normalizeCaughtApiError } from '../../shared/api/httpClient'
import { formatReservationDateTime } from '../../shared/lib/dateFormatting'
import { isReservationConfirmed } from '../../shared/lib/reservationStatus'
import { Button } from '../../shared/ui/Button'
import { ReservationArrivalSummary } from './ReservationArrivalSummary'
import './reservation-arrival.css'

type Props = { reservation: ReservationResponse; refreshKey: number; onChanged: () => void }

export function ReservationLateArrivalPanel({ reservation, refreshKey, onChanged }: Props) {
  const [options, setOptions] = useState<ReservationArrivalOptions | null>(null)
  const [offer, setOffer] = useState<ReservationArrivalOffer | null>(null)
  const [isChoosing, setIsChoosing] = useState(false)
  const [arrivalAt, setArrivalAt] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [now, setNow] = useState(Date.now())
  const [loadKey, setLoadKey] = useState(0)
  const [optionsLoading, setOptionsLoading] = useState(false)
  const dialogRef = useRef<HTMLElement>(null)
  const mutationVersionRef = useRef(0)
  const arrivalChoiceId = useId()
  const eligible = isReservationConfirmed(reservation.status) && !reservation.expectedArrivalAt && !reservation.arrivedAt && !reservation.seatedAt
  const isOpen = isChoosing || Boolean(offer)

  useEffect(() => {
    let current = true
    const version = mutationVersionRef.current
    if (!eligible) {
      setOptions(null)
      setOffer(null)
      setIsChoosing(false)
      setOptionsLoading(false)
      return
    }
    setOptions(null)
    setOptionsLoading(true)
    ecafeApi.reservations.getArrivalOptions(String(reservation.id)).then((data) => {
      if (!current || version !== mutationVersionRef.current) return
      setOptions(data)
      setArrivalAt((selected) => data.canRequest && data.arrivalChoices.some((value) => value === selected && new Date(value).getTime() > Date.now()) ? selected : '')
      setOptionsLoading(false)
      if (data?.offer && !data.offer.accepted) setOffer(data.offer)
      else setOffer(null)
    }).catch((err) => {
      if (current && version === mutationVersionRef.current) {
        setOptionsLoading(false)
        setError(normalizeCaughtApiError(err, 'Gecikmə seçimləri yüklənmədi.').message)
      }
    })
    return () => { current = false }
  }, [reservation.id, eligible, refreshKey, loadKey])

  useEffect(() => {
    if (!isOpen) return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [isOpen])

  useEffect(() => {
    if (offer) dialogRef.current?.focus()
  }, [offer?.consentToken])

  useEffect(() => {
    if (!isOpen) return
    const previousFocus = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialogRef.current?.focus()
    const trap = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); return }
      if (event.key !== 'Tab') return
      const controls = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), select:not(:disabled), [tabindex="0"]') || [])
      if (!controls.length) { event.preventDefault(); return }
      const first = controls[0]
      const last = controls[controls.length - 1]
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) {
        event.preventDefault(); last.focus()
      } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialogRef.current)) {
        event.preventDefault(); first.focus()
      }
    }
    document.addEventListener('keydown', trap)
    return () => {
      document.removeEventListener('keydown', trap)
      document.body.style.overflow = previousOverflow
      previousFocus?.focus()
    }
  }, [isOpen])

  async function requestOffer() {
    if (busy || !options?.canRequest || !options.arrivalChoices.includes(arrivalAt) || new Date(arrivalAt).getTime() <= Date.now()) return
    mutationVersionRef.current++
    setBusy(true); setError('')
    try {
      const result = await ecafeApi.reservations.offerArrival(String(reservation.id), arrivalAt)
      setOffer(result); setIsChoosing(false); setNow(Date.now())
    } catch (err) {
      setError(normalizeCaughtApiError(err, 'Gecikmə üçün icazə alınmadı.').message)
      setLoadKey((value) => value + 1)
    } finally { setBusy(false) }
  }

  async function decide(accept: boolean) {
    if (!offer || busy || accept && (error || new Date(offer.decisionExpiresAt).getTime() <= Date.now())) return
    mutationVersionRef.current++
    setBusy(true); setError('')
    try {
      if (accept) await ecafeApi.reservations.acceptArrival(String(reservation.id), offer.consentToken)
      else await ecafeApi.reservations.cancel(String(reservation.id), 'Gecikmə üçün təklif edilən şərtlərlə razılaşmadım.')
      setOffer(null); setIsChoosing(false); setOptions(null)
      onChanged()
      window.dispatchEvent(new Event('ecafe:notifications-refresh'))
    } catch (err) {
      setError(normalizeCaughtApiError(err, 'Əməliyyat tamamlanmadı.').message)
      setLoadKey((value) => value + 1)
      onChanged()
    } finally { setBusy(false) }
  }

  async function refreshOffer() {
    if (!offer || busy) return
    mutationVersionRef.current++
    setBusy(true); setError('')
    try {
      setOffer(await ecafeApi.reservations.offerArrival(String(reservation.id), offer.arrivalAt))
      setNow(Date.now())
    } catch (err) {
      setError(normalizeCaughtApiError(err, 'Təklif yenilənmədi.').message)
      setLoadKey((value) => value + 1)
    } finally { setBusy(false) }
  }

  const expired = offer && new Date(offer.decisionExpiresAt).getTime() <= now
  const refundAvailable = reservation.canCancelWithRefund && new Date(reservation.refundCancellationDeadlineAt || '').getTime() > now
  const choices = options?.arrivalChoices.filter((value) => new Date(value).getTime() > now) || []
  const noAvailableChoices = eligible && !optionsLoading && options !== null && choices.length === 0 && !offer && !error
  return (
    <>
      <ReservationArrivalSummary reservation={reservation} />
      {eligible ? <div className="reservation-arrival-action">
        {options?.canRequest && choices.length > 0 ? <Button variant="secondary" onClick={() => {
          setError(''); setNow(Date.now()); setArrivalAt(''); setIsChoosing(true); setLoadKey((value) => value + 1)
        }}><Clock3 size={17} />{i18n.t('ui.features.reservations.reservation_late_arrival_panel.gecikirem_1f2c77')}</Button> : null}
        {!isOpen && noAvailableChoices ? <p className="reservation-arrival-unavailable" role="status">{i18n.t('ui.arrival.noAvailableChoices')}</p> : null}
        {!isOpen && error ? <p role="alert">{error}</p> : null}
      </div> : null}
      {isOpen ? <div className="modal-backdrop reservation-action-backdrop">
        <section className="reservation-action-dialog reservation-arrival-dialog" role="dialog" aria-modal="true" aria-labelledby="arrival-dialog-title" tabIndex={-1} ref={dialogRef}>
          <header className="reservation-action-dialog-header">
            <Clock3 size={24} aria-hidden="true" />
            {!offer ? <button type="button" className="reservation-action-dialog-close" aria-label={i18n.t('ui.features.reservations.reservation_late_arrival_panel.pencereni_bagla_15e818')} disabled={busy} onClick={() => setIsChoosing(false)}><X size={18} /></button> : null}
          </header>
          <div className="reservation-action-dialog-body">
            <h2 id="arrival-dialog-title">{offer ?i18n.t('ui.features.reservations.reservation_late_arrival_panel.yeni_gelis_sertleri_8ff778') :i18n.t('ui.features.reservations.reservation_late_arrival_panel.ne_vaxt_catacaqsiniz_2a8dd2')}</h2>
            {!offer ? <div className="reservation-arrival-choice"><label htmlFor={arrivalChoiceId}>{i18n.t('ui.features.reservations.reservation_late_arrival_panel.gelis_vaxti_449387')}</label>
              <select id={arrivalChoiceId} value={arrivalAt} disabled={busy} onChange={(event) => setArrivalAt(event.target.value)}>
                <option value="">{i18n.t('ui.features.reservations.reservation_late_arrival_panel.vaxt_secin_e1e6f0')}</option>
                {choices.map((value) => <option value={value} key={value}>{formatReservationDateTime(value, options?.timeZone)}</option>)}
              </select>
              {optionsLoading ? <p role="status">{i18n.t('ui.arrival.choicesLoading')}</p> : null}
              {noAvailableChoices ? <p className="reservation-arrival-unavailable" role="status">{i18n.t('ui.arrival.noAvailableChoices')}</p> : null}
            </div> : <>
              <dl className="reservation-arrival-terms">
                <div><dt>{i18n.t('ui.features.reservations.reservation_late_arrival_panel.yeni_gelis_vaxti_397ff9')}</dt><dd>{formatReservationDateTime(offer.arrivalAt, offer.timeZone)}</dd></div>
                <div><dt>{i18n.t('ui.features.reservations.reservation_late_arrival_panel.gelis_ucun_son_vaxt_04c872')}</dt><dd>{formatReservationDateTime(offer.noShowDeadlineAt, offer.timeZone)}</dd></div>
                {offer.mustVacateAt ? <div><dt>{i18n.t('ui.features.reservations.reservation_late_arrival_panel.masani_tehvil_vermelisiniz_fd4727')}</dt><dd>{formatReservationDateTime(offer.mustVacateAt, offer.timeZone)}</dd></div> : null}
              </dl>
              <p>{offer.mustVacateAt ? i18n.t('ui.arrival.tableUseDeadline') : i18n.t('ui.features.reservations.reservation_late_arrival_panel.gelis_ucun_son_vaxtadek_masa_sizin_ucu_829c5d')} {i18n.t('ui.features.reservations.reservation_late_arrival_panel.bu_rezervasiya_ucun_gecikme_vaxtini_ya_5a64e5')}</p>
              {offer.hasDeposit ? <p className="reservation-arrival-warning">{refundAvailable ?i18n.t('ui.features.reservations.reservation_late_arrival_panel.legv_zamani_hazirda_depozitin_geri_ode_a7193f') :i18n.t('ui.features.reservations.reservation_late_arrival_panel.hazirda_legv_etseniz_depozit_geri_qayt_51d0fa')} {i18n.t('ui.features.reservations.reservation_late_arrival_panel.gecikme_geri_odenis_ucun_legv_muddetin_e6dac5')}</p> : null}
              <p className="reservation-arrival-expiry" role="status">{expired ?i18n.t('ui.features.reservations.reservation_late_arrival_panel.teklifin_vaxti_bitdi_gelis_ucun_evvelk_d3cc07') : i18n.t('ui.arrival.decisionDeadline', { time: formatReservationDateTime(offer.decisionExpiresAt, offer.timeZone) })}</p>
            </>}
            {error ? <p className="reservation-arrival-error" role="alert">{error}</p> : null}
          </div>
          <footer className="reservation-action-dialog-actions reservation-arrival-dialog-actions">
            {!offer ? <Button disabled={busy || !options?.canRequest || !choices.includes(arrivalAt)} onClick={() => void requestOffer()}><Clock3 size={17} />{busy ?i18n.t('ui.features.reservations.reservation_late_arrival_panel.yoxlanilir_b497d3') :i18n.t('ui.features.reservations.reservation_late_arrival_panel.uygunlugu_yoxla_ddb12a')}</Button> : expired ? <Button disabled={busy} onClick={() => {
              setOffer(null); setIsChoosing(false); setLoadKey((value) => value + 1); onChanged()
            }}>{i18n.t('ui.features.reservations.reservation_late_arrival_panel.bagla_ve_yenile_f750f4')}</Button> : <>
              {error ? <Button disabled={busy} variant="secondary" onClick={() => void refreshOffer()}>{i18n.t('ui.features.reservations.reservation_late_arrival_panel.sertleri_yeniden_yoxla_b5187e')}</Button> : null}
              <Button disabled={busy || Boolean(error)} onClick={() => void decide(true)}><Check size={17} />{busy ?i18n.t('ui.features.reservations.reservation_late_arrival_panel.icra_olunur_e4744c') :i18n.t('ui.features.reservations.reservation_late_arrival_panel.raziyam_masani_saxla_5b8a8b')}</Button>
              <Button disabled={busy} variant="danger" onClick={() => void decide(false)}>{i18n.t('ui.features.reservations.reservation_late_arrival_panel.razi_deyilem_rezervasiyani_legv_et_2a8349')}</Button>
            </>}
          </footer>
        </section>
      </div> : null}
    </>
  )
}
