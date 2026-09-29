import { WalletCards, X } from 'lucide-react'
import { Button } from '../../shared/ui/Button'

type ReservationDepositReviewDialogProps = {
  amount: number | null
  isChanged: boolean
  isSubmitting: boolean
  onCancel: () => void
  onConfirm: () => void
}

export function ReservationDepositReviewDialog({
  amount,
  isChanged,
  isSubmitting,
  onCancel,
  onConfirm,
}: ReservationDepositReviewDialogProps) {
  if (amount === null) return null

  return (
    <div className="modal-backdrop reservation-preorder-backdrop" onMouseDown={onCancel}>
      <section
        aria-labelledby="reservation-deposit-review-title"
        aria-modal="true"
        className="reservation-preorder-dialog"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <header className="reservation-preorder-dialog-header">
          <div className="reservation-preorder-dialog-icon"><WalletCards size={23} /></div>
          <button aria-label="Bağla" className="reservation-preorder-close" onClick={onCancel} type="button"><X size={20} /></button>
        </header>
        <div className="reservation-preorder-dialog-body">
          <h2 id="reservation-deposit-review-title">{isChanged ? 'Depozit məbləği dəyişib' : 'Bu tarix üçün depozit tələb olunur'}</h2>
          <div className="reservation-deposit-notice">
            <span>Hazırkı depozit</span>
            <strong>{amount.toFixed(2)} AZN</strong>
            <p>Restoran ödəniş məlumatlarını göndərdikdən sonra depoziti ödəyib çeki yükləyəcəksiniz. Rezervasiya çek təsdiqləndikdən sonra təsdiqlənəcək.</p>
          </div>
          <p>Bu məbləğlə rezervasiyanı yaratmağa davam edirsiniz?</p>
        </div>
        <footer className="reservation-preorder-dialog-actions">
          <Button disabled={isSubmitting} onClick={onConfirm} type="button">
            {isSubmitting ? 'Rezervasiya yaradılır...' : 'Məbləği qəbul et və davam et'}
          </Button>
          <Button disabled={isSubmitting} onClick={onCancel} type="button" variant="secondary">Geri qayıt</Button>
        </footer>
      </section>
    </div>
  )
}
