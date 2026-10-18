import { AlertTriangle, X } from 'lucide-react'
import { Button } from './Button'
import { useTranslation } from 'react-i18next'

type ConfirmDialogProps = {
  confirmLabel?: string
  confirmDisabled?: boolean
  isOpen: boolean
  isDanger?: boolean
  message: string
  title: string
  onCancel: () => void
  onConfirm: () => void
}

export function ConfirmDialog({
  confirmLabel,
  confirmDisabled = false,
  isDanger = true,
  isOpen,
  message,
  onCancel,
  onConfirm,
  title,
}: ConfirmDialogProps) {
  const { t } = useTranslation()
  if (!isOpen) {
    return null
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section aria-modal="true" className="confirm-dialog" role="dialog">
        <header>
          <span className={isDanger ? 'confirm-dialog-icon danger' : 'confirm-dialog-icon'}>
            <AlertTriangle size={20} />
          </span>
          <button aria-label={t('ui.common.close')} onClick={onCancel} type="button">
            <X size={18} />
          </button>
        </header>
        <h2>{title}</h2>
        <p>{message}</p>
        <footer>
          <Button onClick={onCancel} type="button" variant="secondary">
            {t('ui.common.cancel')}
          </Button>
          <Button disabled={confirmDisabled} onClick={onConfirm} type="button" variant={isDanger ? 'danger' : 'primary'}>
            {confirmLabel ?? t('ui.common.confirm')}
          </Button>
        </footer>
      </section>
    </div>
  )
}
