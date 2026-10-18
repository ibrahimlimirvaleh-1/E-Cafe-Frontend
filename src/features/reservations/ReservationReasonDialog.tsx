import { i18n } from '../../shared/i18n/i18n'
import { AlertTriangle, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button, type ButtonVariant } from '../../shared/ui/Button'
import { TextareaField } from '../../shared/ui/FormField'
import { StatusMessage } from '../../shared/ui/StatusMessage'

type ReservationReasonDialogProps = {
  isOpen: boolean
  title: string
  description: string
  confirmLabel: string
  isSubmitting: boolean
  error?: string
  requireReason?: boolean
  showReason?: boolean
  confirmVariant?: ButtonVariant
  onClose: () => void
  onConfirm: (reason: string) => void
}

export function ReservationReasonDialog({
  isOpen,
  title,
  description,
  confirmLabel,
  isSubmitting,
  error = '',
  requireReason = false,
  showReason = false,
  confirmVariant = 'danger',
  onClose,
  onConfirm,
}: ReservationReasonDialogProps) {
  const [reason, setReason] = useState('')

  useEffect(() => {
    if (isOpen) {
      setReason('')
    }
  }, [isOpen])

  if (!isOpen) {
    return null
  }

  const canSubmit = !isSubmitting && (!requireReason || reason.trim().length > 0)

  return (
    <div className="modal-backdrop reservation-action-backdrop" role="presentation">
      <section
        aria-labelledby="reservation-action-dialog-title"
        aria-modal="true"
        className="reservation-action-dialog"
        role="dialog"
      >
        <header className="reservation-action-dialog-header">
          <div className="reservation-action-dialog-icon" aria-hidden="true">
            <AlertTriangle size={20} />
          </div>
          <button aria-label={i18n.t('ui.features.reservations.reservation_reason_dialog.pencereni_bagla_15e818')} className="reservation-action-dialog-close" onClick={onClose} type="button">
            <X size={18} />
          </button>
        </header>
        <div className="reservation-action-dialog-body">
          <h2 id="reservation-action-dialog-title">{title}</h2>
          <p>{description}</p>
          {showReason || requireReason ? (
            <TextareaField
              label={requireReason ?i18n.t('ui.features.reservations.reservation_reason_dialog.sebeb_33efd0') :i18n.t('ui.features.reservations.reservation_reason_dialog.sebeb_isteye_gore_ee545f')}
              maxLength={500}
              onChange={(event) => setReason(event.target.value)}
              placeholder={i18n.t('ui.features.reservations.reservation_reason_dialog.sebebi_yazin_c1ce48')}
              rows={4}
              value={reason}
            />
          ) : null}
          {error ? <StatusMessage tone="danger">{error}</StatusMessage> : null}
        </div>
        <footer className="reservation-action-dialog-actions">
          <Button disabled={isSubmitting} onClick={onClose} type="button" variant="secondary">{i18n.t('ui.features.reservations.reservation_reason_dialog.bagla_c1cf91')}</Button>
          <Button disabled={!canSubmit} onClick={() => onConfirm(reason.trim())} type="button" variant={confirmVariant}>
            {isSubmitting ?i18n.t('ui.features.reservations.reservation_reason_dialog.gozleyin_1dc931') : confirmLabel}
          </Button>
        </footer>
      </section>
    </div>
  )
}
