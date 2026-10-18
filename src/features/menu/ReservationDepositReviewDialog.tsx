import { i18n } from '../../shared/i18n/i18n'
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
          <button aria-label={i18n.t('ui.features.menu.reservation_deposit_review_dialog.bagla_c1cf91')} className="reservation-preorder-close" onClick={onCancel} type="button"><X size={20} /></button>
        </header>
        <div className="reservation-preorder-dialog-body">
          <h2 id="reservation-deposit-review-title">{amount === 0 ?i18n.t('ui.features.menu.reservation_deposit_review_dialog.depozit_telebi_legv_edilib_c95c94') : isChanged ?i18n.t('ui.features.menu.reservation_deposit_review_dialog.depozit_meblegi_deyisib_f81ff4') :i18n.t('ui.features.menu.reservation_deposit_review_dialog.bu_tarix_ucun_depozit_teleb_olunur_7c638b')}</h2>
          <div className="reservation-deposit-notice">
            <span>{i18n.t('ui.features.menu.reservation_deposit_review_dialog.hazirki_depozit_e4ddbc')}</span>
            <strong>{amount > 0 ? `${amount.toFixed(2)} AZN` :i18n.t('ui.features.menu.reservation_deposit_review_dialog.teleb_olunmur_46f021')}</strong>
            <p>{amount > 0
              ?i18n.t('ui.features.menu.reservation_deposit_review_dialog.restoran_odenis_melumatlarini_gonderdi_825dd8')
              :i18n.t('ui.features.menu.reservation_deposit_review_dialog.restoran_bu_tarix_ucun_depozit_qaydasi_6a653a')}</p>
          </div>
          <p>{amount > 0 ?i18n.t('ui.features.menu.reservation_deposit_review_dialog.bu_meblegle_rezervasiyani_yaratmaga_da_e91300') :i18n.t('ui.features.menu.reservation_deposit_review_dialog.depozitsiz_rezervasiyaya_davam_edirsin_65a5d2')}</p>
        </div>
        <footer className="reservation-preorder-dialog-actions">
          <Button disabled={isSubmitting} onClick={onConfirm} type="button">
            {isSubmitting ?i18n.t('ui.features.menu.reservation_deposit_review_dialog.rezervasiya_yaradilir_b4b84c') : amount === 0 ?i18n.t('ui.features.menu.reservation_deposit_review_dialog.depozitsiz_davam_et_d8b0ef') :i18n.t('ui.features.menu.reservation_deposit_review_dialog.meblegi_qebul_et_ve_davam_et_68a3d1')}
          </Button>
          <Button disabled={isSubmitting} onClick={onCancel} type="button" variant="secondary">{i18n.t('ui.features.menu.reservation_deposit_review_dialog.geri_qayit_f53c97')}</Button>
        </footer>
      </section>
    </div>
  )
}
