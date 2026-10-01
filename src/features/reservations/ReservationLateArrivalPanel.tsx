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
  const dialogRef = useRef<HTMLElement>(null)
  const mutationVersionRef = useRef(0)
  const arrivalChoiceId = useId()
  const eligible = isReservationConfirmed(reservation.status) && !reservation.expectedArrivalAt
  const isOpen = isChoosing || Boolean(offer)

  useEffect(() => {
    let current = true
    const version = mutationVersionRef.current
    if (!eligible) {
      setOptions(null)
      setOffer(null)
      setIsChoosing(false)
      return
    }
    ecafeApi.reservations.getArrivalOptions(String(reservation.id)).then((data) => {
      if (!current || version !== mutationVersionRef.current) return
      setOptions(data)
      if (data?.offer && !data.offer.accepted) setOffer(data.offer)
      else setOffer(null)
    }).catch((err) => {
      if (current && version === mutationVersionRef.current) setError(normalizeCaughtApiError(err, 'Gecikmə seçimləri yüklənmədi.').message)
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
    if (!arrivalAt || busy) return
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
    if (!offer || busy) return
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
  return (
    <>
      <ReservationArrivalSummary reservation={reservation} />
      {eligible ? <div className="reservation-arrival-action">
        {options?.canRequest ? <Button variant="secondary" onClick={() => {
          setError(''); setNow(Date.now()); setArrivalAt(''); setIsChoosing(true); setLoadKey((value) => value + 1)
        }}><Clock3 size={17} />Gecikirəm</Button> : null}
        {!isOpen && error ? <p role="alert">{error}</p> : null}
      </div> : null}
      {isOpen ? <div className="modal-backdrop reservation-action-backdrop">
        <section className="reservation-action-dialog reservation-arrival-dialog" role="dialog" aria-modal="true" aria-labelledby="arrival-dialog-title" tabIndex={-1} ref={dialogRef}>
          <header className="reservation-action-dialog-header">
            <Clock3 size={24} aria-hidden="true" />
            {!offer ? <button type="button" className="reservation-action-dialog-close" aria-label="Pəncərəni bağla" disabled={busy} onClick={() => setIsChoosing(false)}><X size={18} /></button> : null}
          </header>
          <div className="reservation-action-dialog-body">
            <h2 id="arrival-dialog-title">{offer ? 'Yeni gəliş şərtləri' : 'Nə vaxt çatacaqsınız?'}</h2>
            {!offer ? <div className="reservation-arrival-choice"><label htmlFor={arrivalChoiceId}>Gəliş vaxtı</label>
              <select id={arrivalChoiceId} value={arrivalAt} disabled={busy} onChange={(event) => setArrivalAt(event.target.value)}>
                <option value="">Vaxt seçin</option>
                {choices.map((value) => <option value={value} key={value}>{formatReservationDateTime(value, options?.timeZone)}</option>)}
              </select>
            </div> : <>
              <dl className="reservation-arrival-terms">
                <div><dt>Yeni gəliş vaxtı</dt><dd>{formatReservationDateTime(offer.arrivalAt, offer.timeZone)}</dd></div>
                <div><dt>Gəliş üçün son vaxt</dt><dd>{formatReservationDateTime(offer.noShowDeadlineAt, offer.timeZone)}</dd></div>
                {offer.mustVacateAt ? <div><dt>Masanı təhvil verməlisiniz</dt><dd>{formatReservationDateTime(offer.mustVacateAt, offer.timeZone)}</dd></div> : null}
              </dl>
              <p>{offer.mustVacateAt ? 'Növbəti rezervasiya üçün masanı göstərilən vaxtadək təhvil vermək şərti ilə gözlədiləcəksiniz.' : 'Gəliş üçün son vaxtadək masa sizin üçün saxlanacaq.'} Bu rezervasiya üçün gecikmə vaxtını yalnız bir dəfə dəyişə bilərsiniz.</p>
              {offer.hasDeposit ? <p className="reservation-arrival-warning">{refundAvailable ? 'Ləğv zamanı hazırda depozitin geri ödənişinə uyğun gəlirsiniz.' : 'Hazırda ləğv etsəniz depozit geri qaytarılmır.'} Gecikmə geri ödəniş üçün ləğv müddətini uzatmır.</p> : null}
              <p className="reservation-arrival-expiry" role="status">{expired ? 'Təklifin vaxtı bitdi. Gəliş üçün əvvəlki son vaxt qüvvədə qalır.' : `Qərar üçün son vaxt: ${formatReservationDateTime(offer.decisionExpiresAt, offer.timeZone)}`}</p>
            </>}
            {error ? <p className="reservation-arrival-error" role="alert">{error}</p> : null}
          </div>
          <footer className="reservation-action-dialog-actions reservation-arrival-dialog-actions">
            {!offer ? <Button disabled={busy || !choices.includes(arrivalAt)} onClick={() => void requestOffer()}><Clock3 size={17} />{busy ? 'Yoxlanılır...' : 'Uyğunluğu yoxla'}</Button> : expired ? <Button disabled={busy} onClick={() => {
              setOffer(null); setIsChoosing(false); setLoadKey((value) => value + 1); onChanged()
            }}>Bağla və yenilə</Button> : <>
              {error ? <Button disabled={busy} variant="secondary" onClick={() => void refreshOffer()}>Şərtləri yenidən yoxla</Button> : null}
              <Button disabled={busy} onClick={() => void decide(true)}><Check size={17} />{busy ? 'İcra olunur...' : 'Razıyam, masanı saxla'}</Button>
              <Button disabled={busy} variant="danger" onClick={() => void decide(false)}>Razı deyiləm, rezervasiyanı ləğv et</Button>
            </>}
          </footer>
        </section>
      </div> : null}
    </>
  )
}
