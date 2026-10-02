import { Check, Clock3, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { normalizeCaughtApiError } from '../../shared/api/httpClient'
import { formatReservationDateTime } from '../../shared/lib/dateFormatting'
import { Button } from '../../shared/ui/Button'
import { StatusMessage } from '../../shared/ui/StatusMessage'
import { scheduleApi, type ScheduleOffer } from './scheduleApi'
import './schedule.css'

export function ScheduleOfferPanel({ reservationId, refreshKey, onChanged }: {
  reservationId: string; refreshKey: number; onChanged: () => void
}) {
  const [offer, setOffer] = useState<ScheduleOffer | null>(null)
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const version = useRef(0)
  useEffect(() => {
    let active = true
    const currentVersion = version.current
    scheduleApi.offer(reservationId).then((value) => {
      if (active && version.current === currentVersion) {
        setOffer(value); setConsent(false)
      }
    }).catch((err) => {
      if (active && version.current === currentVersion) setError(normalizeCaughtApiError(err, 'İş saatı təklifi yüklənmədi.').message)
    })
    return () => { active = false }
  }, [reservationId, refreshKey])

  async function respond(accept: boolean) {
    if (!offer || busy || !offer.canRespond || accept && (!offer.canAccept || !consent)) return
    version.current++
    setBusy(true); setError('')
    try {
      setOffer(await scheduleApi.respond(reservationId, offer.token, accept))
      setConsent(false)
      onChanged()
      window.dispatchEvent(new Event('ecafe:notifications-refresh'))
    } catch (err) {
      setError(normalizeCaughtApiError(err, 'Cavabınız saxlanılmadı.').message)
      onChanged()
    } finally { setBusy(false) }
  }

  if (!offer && !error) return null
  return <section className="schedule-section" aria-labelledby="schedule-offer-title" id="schedule-offer">
    <h2 id="schedule-offer-title"><Clock3 size={20} /> İş saatı dəyişikliyi</h2>
    {offer ? <>
      <p>{offer.reason}</p>
      {offer.proposedVacateAt ? <dl className="schedule-deadline">
        <dt>Təklif edilən masa təhvil vaxtı</dt>
        <dd>{formatReservationDateTime(offer.proposedVacateAt, offer.timeZone)}</dd>
      </dl> : <p>Yeni iş saatları gəliş vaxtınıza uyğun deyil. Restoranla əlaqə saxlayın.</p>}
      {offer.canRespond ? <>
        {offer.canAccept ? <label className="schedule-consent">
          <input type="checkbox" checked={consent} disabled={busy} onChange={(event) => setConsent(event.target.checked)} />
          <span>Masanı göstərilən vaxtda təhvil verməklə razıyam.</span>
        </label> : null}
        <div className="schedule-actions">
          {offer.canAccept ? <Button type="button" disabled={busy || !consent} onClick={() => respond(true)}><Check size={17} /> Qəbul et</Button> : null}
          <Button type="button" disabled={busy} variant="secondary" onClick={() => respond(false)}><X size={17} /> Qəbul etmirəm</Button>
        </div>
        <p className="schedule-muted">Cavab verməmək razılıq sayılmır. Təklifi rədd etmək rezervasiyanızı ləğv etmir.</p>
      </> : <p role="status">{{
        Pending: 'Bu təklif hazırda cavablandırıla bilmir. Restoranla əlaqə saxlayın.',
        Accepted: 'Razılığınız qeydə alındı. Restoran dəyişikliyi tətbiq edənədək əvvəlki şərtlər qüvvədədir.',
        Rejected: 'Təklifi qəbul etmədiniz. Rezervasiyanız ləğv edilməyib; restoran məsələni həll edəcək.',
        Applied: 'Yeni iş saatları və razılaşdırılmış masa təhvil vaxtı tətbiq edildi.',
        Withdrawn: 'Təklif geri götürüldü. Əvvəlki rezervasiya şərtləriniz qüvvədədir.',
      }[offer.state]}</p>}
    </> : null}
    {error ? <StatusMessage tone="danger" autoHideMs={false}>{error}</StatusMessage> : null}
  </section>
}
