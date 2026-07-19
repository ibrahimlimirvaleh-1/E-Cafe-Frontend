import { FileWarning, ShieldCheck } from 'lucide-react'

type GuardNoticeProps = {
  active: boolean
}

export function ContractGuardNotice({ active }: GuardNoticeProps) {
  if (active) {
    return (
      <div className="contract-guard contract-guard-ok">
        <ShieldCheck size={20} />
        Active müqavilə var. Public booking, order və online payment axınları açıqdır.
      </div>
    )
  }

  return (
    <div className="contract-guard contract-guard-blocked">
      <FileWarning size={20} />
      Active müqavilə yoxdur. TT Rev E qaydasına görə booking, dine-in order və payment close bloklanmalıdır.
    </div>
  )
}
