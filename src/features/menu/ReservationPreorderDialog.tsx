import { CalendarCheck2, ShoppingBag, WalletCards, X } from 'lucide-react'
import { Button } from '../../shared/ui/Button'

type ReservationPreorderDialogProps = {
  isOpen: boolean
  isSubmitting?: boolean
  onCancel: () => void
  onPreorder: () => void
  onSkip: () => void
  depositAmount?: number
  limitedSeatingMessage?: string | null
  acceptsLimitedSeating?: boolean
  onAcceptLimitedSeating?: (accepted: boolean) => void
}

export function ReservationPreorderDialog({
  isOpen,
  isSubmitting = false,
  onCancel,
  onPreorder,
  onSkip,
  depositAmount,
  limitedSeatingMessage,
  acceptsLimitedSeating = false,
  onAcceptLimitedSeating,
}: ReservationPreorderDialogProps) {
  if (!isOpen) {
    return null
  }

  return (
    <div className="modal-backdrop reservation-preorder-backdrop" onMouseDown={onCancel}>
      <section
        aria-labelledby="reservation-preorder-title"
        aria-modal="true"
        className="reservation-preorder-dialog"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <header className="reservation-preorder-dialog-header">
          <div className="reservation-preorder-dialog-icon">
            {depositAmount && depositAmount > 0 ? <WalletCards size={23} /> : <CalendarCheck2 size={23} />}
          </div>
          <button aria-label="Bağla" className="reservation-preorder-close" onClick={onCancel} type="button">
            <X size={20} />
          </button>
        </header>
        <div className="reservation-preorder-dialog-body">
          <h2 id="reservation-preorder-title">{depositAmount && depositAmount > 0 ? 'Bu tarix üçün depozit tələb olunur' : 'Öncədən sifariş etmək istəyirsiniz?'}</h2>
          {depositAmount && depositAmount > 0 ? (
            <div className="reservation-deposit-notice">
              <span>Rezervasiya depoziti</span>
              <strong>{depositAmount.toFixed(2)} AZN</strong>
              <p>Restoran ödəniş məlumatlarını göndərdikdən sonra depoziti ödəyib çeki yükləyəcəksiniz. Rezervasiya çek təsdiqləndikdən sonra təsdiqlənəcək.</p>
            </div>
          ) : null}
          <p>Masanız seçildi. Menyudan öncədən sifariş əlavə edə və ya menyusuz davam edə bilərsiniz.</p>
          {limitedSeatingMessage ? (
            <label className="reservation-limited-seating-confirmation">
              <input
                checked={acceptsLimitedSeating}
                onChange={(event) => onAcceptLimitedSeating?.(event.target.checked)}
                type="checkbox"
              />
              <span>{limitedSeatingMessage}</span>
            </label>
          ) : null}
        </div>
        <footer className="reservation-preorder-dialog-actions">
          <Button className="reservation-preorder-option reservation-preorder-option-primary" disabled={isSubmitting || Boolean(limitedSeatingMessage && !acceptsLimitedSeating)} onClick={onPreorder} type="button">
            <ShoppingBag size={18} />
            Menyuya keç
          </Button>
          <Button className="reservation-preorder-option" disabled={isSubmitting || Boolean(limitedSeatingMessage && !acceptsLimitedSeating)} onClick={onSkip} variant="secondary" type="button">
            {isSubmitting ? 'Rezervasiya yaradılır...' : 'Menyusuz davam et'}
          </Button>
        </footer>
      </section>
    </div>
  )
}
