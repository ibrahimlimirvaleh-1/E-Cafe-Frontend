import { i18n } from '../../shared/i18n/i18n'
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
          <button aria-label={i18n.t('ui.features.menu.reservation_preorder_dialog.bagla_c1cf91')} className="reservation-preorder-close" onClick={onCancel} type="button">
            <X size={20} />
          </button>
        </header>
        <div className="reservation-preorder-dialog-body">
          <h2 id="reservation-preorder-title">{depositAmount && depositAmount > 0 ?i18n.t('ui.features.menu.reservation_preorder_dialog.bu_tarix_ucun_depozit_teleb_olunur_7c638b') :i18n.t('ui.features.menu.reservation_preorder_dialog.onceden_sifaris_etmek_isteyirsiniz_067d12')}</h2>
          {depositAmount && depositAmount > 0 ? (
            <div className="reservation-deposit-notice">
              <span>{i18n.t('ui.features.menu.reservation_preorder_dialog.rezervasiya_depoziti_4faaff')}</span>
              <strong>{depositAmount.toFixed(2)} AZN</strong>
              <p>{i18n.t('ui.features.menu.reservation_preorder_dialog.restoran_odenis_melumatlarini_gonderdi_825dd8')}</p>
            </div>
          ) : null}
          <p>{i18n.t('ui.features.menu.reservation_preorder_dialog.masaniz_secildi_menyudan_onceden_sifar_a8a10a')}</p>
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
            {i18n.t('ui.features.menu.reservation_preorder_dialog.menyuya_kec_72944c')}
          </Button>
          <Button className="reservation-preorder-option" disabled={isSubmitting || Boolean(limitedSeatingMessage && !acceptsLimitedSeating)} onClick={onSkip} variant="secondary" type="button">
            {isSubmitting ?i18n.t('ui.features.menu.reservation_preorder_dialog.rezervasiya_yaradilir_b4b84c') :i18n.t('ui.features.menu.reservation_preorder_dialog.menyusuz_davam_et_fba089')}
          </Button>
        </footer>
      </section>
    </div>
  )
}
