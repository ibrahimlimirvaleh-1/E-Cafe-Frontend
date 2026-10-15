import { Clock3, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '../../shared/ui/Button'
import { StatusMessage } from '../../shared/ui/StatusMessage'

type Props = {
  isOpen: boolean
  isSubmitting: boolean
  error: string
  onClose: () => void
  onConfirm: (reviewAgainAt: string, reason: string) => void
}

// datetime-local cihaz vaxtını göstərir; serverə isə həmin anın UTC ISO dəyəri göndərilir.
function toLocalInputValue(date: Date) {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function SessionContinueDialog({ isOpen, isSubmitting, error, onClose, onConfirm }: Props) {
  const [reviewAgainAt, setReviewAgainAt] = useState('')
  const [reason, setReason] = useState('')

  useEffect(() => {
    if (!isOpen) return
    setReviewAgainAt(toLocalInputValue(new Date(Date.now() + 60 * 60_000)))
    setReason('')
  }, [isOpen])

  if (!isOpen) return null

  const chosenAt = new Date(reviewAgainAt)
  const delayMs = chosenAt.getTime() - Date.now()
  const validTime = Number.isFinite(delayMs) && delayMs > 0 && delayMs <= 24 * 60 * 60_000
  const validReason = reason.trim().length > 0 && reason.trim().length <= 500

  return <div className="modal-backdrop reservation-action-backdrop" role="presentation">
    <section aria-labelledby="session-continue-dialog-title" aria-modal="true" className="reservation-action-dialog session-continue-dialog" role="dialog">
      <header className="reservation-action-dialog-header">
        <div className="reservation-action-dialog-icon" aria-hidden="true"><Clock3 size={20} /></div>
        <button aria-label="Pəncərəni bağla" className="reservation-action-dialog-close" onClick={onClose} type="button"><X size={18} /></button>
      </header>
      <div className="reservation-action-dialog-body">
        <h2 id="session-continue-dialog-title">Xidmət davam edir?</h2>
        <p>Masa açıq qalacaq. Yenidən yoxlama vaxtını və səbəbi qeyd edin.</p>
        <label className="session-continue-field">Növbəti yoxlama vaxtı
          <input type="datetime-local" value={reviewAgainAt} onChange={(event) => setReviewAgainAt(event.target.value)} />
        </label>
        <label className="session-continue-field">Səbəb
          <textarea maxLength={500} rows={3} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Xidmətin niyə davam etdiyini qeyd edin" />
        </label>
        {reviewAgainAt && !validTime ? <span className="session-continue-validation">Vaxt gələcəkdə və ən çox 24 saat sonra olmalıdır.</span> : null}
        {error ? <StatusMessage tone="danger" autoHideMs={false}>{error}</StatusMessage> : null}
      </div>
      <footer className="reservation-action-dialog-actions">
        <Button type="button" variant="secondary" disabled={isSubmitting} onClick={onClose}>Bağla</Button>
        <Button type="button" disabled={isSubmitting || !validTime || !validReason} onClick={() => onConfirm(chosenAt.toISOString(), reason.trim())}>{isSubmitting ? 'Gözləyin...' : 'Xidməti davam etdir'}</Button>
      </footer>
    </section>
  </div>
}
