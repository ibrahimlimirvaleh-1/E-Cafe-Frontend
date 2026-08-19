import { AlertTriangle, X } from 'lucide-react'
import { Button } from './Button'

type ConfirmDialogProps = {
  confirmLabel?: string
  isOpen: boolean
  isDanger?: boolean
  message: string
  title: string
  onCancel: () => void
  onConfirm: () => void
}

export function ConfirmDialog({
  confirmLabel = 'Təsdiqlə',
  isDanger = true,
  isOpen,
  message,
  onCancel,
  onConfirm,
  title,
}: ConfirmDialogProps) {
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
          <button aria-label="Bağla" onClick={onCancel} type="button">
            <X size={18} />
          </button>
        </header>
        <h2>{title}</h2>
        <p>{message}</p>
        <footer>
          <Button onClick={onCancel} type="button" variant="secondary">
            Ləğv et
          </Button>
          <Button onClick={onConfirm} type="button" variant={isDanger ? 'danger' : 'primary'}>
            {confirmLabel}
          </Button>
        </footer>
      </section>
    </div>
  )
}
