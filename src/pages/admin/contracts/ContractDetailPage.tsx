import { CheckCircle2, FileText, Send, ShieldCheck, XCircle } from 'lucide-react'
import { useState } from 'react'
import { useParams } from 'react-router-dom'
import type { ContractStatus, RestaurantContract, StatusTone, WorkflowAction } from '../../../entities/types'
import { ecafeApi } from '../../../shared/api/ecafeApi'
import { contractStatusLabel } from '../../../shared/api/mappers'
import { useAsyncData } from '../../../shared/hooks/useAsyncData'
import { Badge } from '../../../shared/ui/Badge'
import { Button, ButtonLink } from '../../../shared/ui/Button'
import { TextareaField } from '../../../shared/ui/FormField'
import { PageHeader } from '../../../shared/ui/PageHeader'

function statusTone(status: ContractStatus): StatusTone {
  if (status === 'Active' || status === 'OwnerApproved') {
    return 'success'
  }

  if (status === 'Draft' || status === 'PendingSignature') {
    return 'warning'
  }

  if (status === 'Terminated' || status === 'Expired') {
    return 'danger'
  }

  return 'neutral'
}

function formatDate(value: string) {
  if (!value) {
    return '-'
  }

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('az-AZ')
}

function nextActionText(contract: RestaurantContract, actions: WorkflowAction[]) {
  if (actions.some((action) => action.code === 'approve')) {
    return 'Müqavilə təsdiqinizi gözləyir. Sənədi oxuyub şərtləri qəbul etdikdən sonra admin aktivləşdirə biləcək.'
  }

  if (actions.some((action) => action.code === 'sendForSignature')) {
    return 'Müqavilə hazırdır. Növbəti addım sənədi restoran sahibinə təsdiq üçün göndərməkdir.'
  }

  if (contract.status === 'PendingSignature') {
    return 'Müqavilə restoran sahibinin təsdiqini gözləyir.'
  }

  if (contract.status === 'OwnerApproved') {
    return 'Restoran sahibi müqaviləni təsdiqləyib. Admin aktivləşdirdikdən sonra restoran əməliyyatları açılır.'
  }

  if (contract.status === 'Active') {
    return 'Müqavilə aktivdir. Lazım olarsa ləğv əməliyyatı icra edilə bilər.'
  }

  return 'Bu müqavilə üzrə aktiv əməliyyat yoxdur.'
}

export function ContractDetailPage() {
  const { contractId = '' } = useParams()
  const [reloadKey, setReloadKey] = useState(0)
  const [hasAcceptedContractTerms, setHasAcceptedContractTerms] = useState(false)
  const [acceptanceText, setAcceptanceText] = useState('Müqaviləni oxudum və şərtlərini qəbul edirəm.')
  const [actionError, setActionError] = useState('')
  const [actionName, setActionName] = useState('')
  const { data: record, isLoading } = useAsyncData(() => ecafeApi.contracts.get(contractId), null, [contractId, reloadKey])
  const contract = record?.contract

  async function runAction(name: string, action: () => Promise<unknown>) {
    setActionError('')
    setActionName(name)
    try {
      await action()
      window.dispatchEvent(new Event('ecafe:notifications-refresh'))
      setReloadKey((value) => value + 1)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Əməliyyat icra olunmadı.')
    } finally {
      setActionName('')
    }
  }

  if (isLoading || !contract) {
    return (
      <main className="admin-page narrow">
        <p className="online-only">Müqavilə məlumatları yüklənir...</p>
      </main>
    )
  }

  const isBusy = actionName !== ''
  const availableActions = contract.availableActions ?? []
  const sendForSignatureAction = availableActions.find((action) => action.code === 'sendForSignature')
  const approveAction = availableActions.find((action) => action.code === 'approve')
  const activateAction = availableActions.find((action) => action.code === 'activate')
  const terminateAction = availableActions.find((action) => action.code === 'terminate')
  const hasVisibleAction = availableActions.length > 0

  return (
    <main className="admin-page narrow">
      <PageHeader
        eyebrow="Müqavilə"
        title={contract.contractNumber || `Müqavilə #${contract.id}`}
        description={record.restaurantName}
        action={<ButtonLink to="/admin/contracts" variant="secondary">Siyahıya qayıt</ButtonLink>}
      />

      <section className="detail-panel contract-detail-panel">
        <div className="contract-status-line">
          <Badge tone={statusTone(contract.status)}>{contractStatusLabel(contract)}</Badge>
          {contract.fileUrl ? (
            <a className="contract-file-link" href={contract.fileUrl} rel="noreferrer" target="_blank">
              <FileText size={18} />
              Müqavilə sənədini aç
            </a>
          ) : (
            <span className="contract-file-link muted">
              <FileText size={18} />
              Sənəd hələ hazır deyil
            </span>
          )}
        </div>

        <dl>
          <div>
            <dt>Restoran</dt>
            <dd>{record.restaurantName}</dd>
          </div>
          <div>
            <dt>Başlama tarixi</dt>
            <dd>{formatDate(contract.startDate)}</dd>
          </div>
          <div>
            <dt>Bitmə tarixi</dt>
            <dd>{formatDate(contract.endDate)}</dd>
          </div>
          <div>
            <dt>Komissiya</dt>
            <dd>{contract.commissionPercent}%</dd>
          </div>
          <div>
            <dt>Hesablaşma dövrü</dt>
            <dd>{contract.settlementPeriod || '-'} gün</dd>
          </div>
          <div>
            <dt>Ödəniş</dt>
            <dd>Fiziki/offline</dd>
          </div>
          <div>
            <dt>Təsdiqləyən</dt>
            <dd>{contract.signedByUserName || '-'}</dd>
          </div>
          <div>
            <dt>Təsdiq vaxtı</dt>
            <dd>{formatDate(contract.signedAt || '')}</dd>
          </div>
          <div>
            <dt>Fayl</dt>
            <dd>{contract.fileId ? `#${contract.fileId}` : '-'}</dd>
          </div>
        </dl>
      </section>

      <section className="contract-action-panel">
        <div>
          <h2>Növbəti əməliyyat</h2>
          <p>{nextActionText(contract, availableActions)}</p>
        </div>

        {sendForSignatureAction ? (
          <Button
            disabled={isBusy}
            onClick={() => runAction('send', () => ecafeApi.contracts.sendForSignature(contract.restaurantId, contract.id))}
          >
            <Send size={18} />
            {actionName === 'send' ? 'Göndərilir...' : sendForSignatureAction.label}
          </Button>
        ) : null}

        {approveAction ? (
          <div className="contract-approval-box">
            <label className="contract-checkbox">
              <input
                checked={hasAcceptedContractTerms}
                onChange={(event) => setHasAcceptedContractTerms(event.target.checked)}
                type="checkbox"
              />
              <span>Müqaviləni oxudum və şərtlərini qəbul edirəm.</span>
            </label>
            <TextareaField
              label="Qəbul mətni"
              onChange={(event) => setAcceptanceText(event.target.value)}
              rows={3}
              value={acceptanceText}
            />
            <Button
              disabled={isBusy || !hasAcceptedContractTerms || !acceptanceText.trim()}
              onClick={() =>
                runAction('approve', () =>
                  ecafeApi.contracts.approve(contract.restaurantId, contract.id, {
                    hasAcceptedContractTerms,
                    acceptanceText,
                  }),
                )
              }
            >
              <CheckCircle2 size={18} />
              {actionName === 'approve' ? 'Təsdiqlənir...' : approveAction.label}
            </Button>
          </div>
        ) : null}

        {activateAction ? (
          <Button
            disabled={isBusy}
            onClick={() => runAction('activate', () => ecafeApi.contracts.activate(contract.restaurantId, contract.id))}
          >
            <ShieldCheck size={18} />
            {actionName === 'activate' ? 'Aktivləşdirilir...' : activateAction.label}
          </Button>
        ) : null}

        {terminateAction ? (
          <Button
            disabled={isBusy}
            onClick={() => runAction('terminate', () => ecafeApi.contracts.terminate(contract.restaurantId, contract.id))}
            variant="danger"
          >
            <XCircle size={18} />
            {actionName === 'terminate' ? 'Ləğv edilir...' : terminateAction.label}
          </Button>
        ) : null}

        {!hasVisibleAction ? <p className="muted-text">Sizin rolunuz üçün bu statusda icra ediləcək əməliyyat yoxdur.</p> : null}
        {actionError ? <p className="form-error">{actionError}</p> : null}
      </section>
    </main>
  )
}
