import { FileWarning, ShieldCheck } from 'lucide-react'

type GuardNoticeProps = {
  active: boolean
}

export function ContractGuardNotice({ active }: GuardNoticeProps) {
  if (active) {
    return (
      <div className="contract-guard contract-guard-ok">
        <ShieldCheck size={20} />
        Aktiv müqavilə var.
      </div>
    )
  }

  return (
    <div className="contract-guard contract-guard-blocked">
      <FileWarning size={20} />
      Aktiv müqavilə yoxdur.
    </div>
  )
}
