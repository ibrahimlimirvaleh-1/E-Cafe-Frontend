import { i18n } from '../i18n/i18n'
import { FileWarning, ShieldCheck } from 'lucide-react'

type GuardNoticeProps = {
  active: boolean
}

export function ContractGuardNotice({ active }: GuardNoticeProps) {
  if (active) {
    return (
      <div className="contract-guard contract-guard-ok">
        <ShieldCheck size={20} />
        {i18n.t('ui.shared.ui.guard_notice.aktiv_muqavile_var_dae5d6')}
      </div>
    )
  }

  return (
    <div className="contract-guard contract-guard-blocked">
      <FileWarning size={20} />
      {i18n.t('ui.shared.ui.guard_notice.aktiv_muqavile_yoxdur_1149ac')}
    </div>
  )
}
