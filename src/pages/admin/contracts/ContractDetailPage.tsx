import { CheckCircle2, Download, Eye, FileText, Send, ShieldCheck, XCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import type { ContractStatus, RestaurantContract, StatusTone, WorkflowAction } from '../../../entities/types'
import { ecafeApi } from '../../../shared/api/ecafeApi'
import { normalizeCaughtApiError, type ApiErrorDetail } from '../../../shared/api/httpClient'
import { contractStatusLabel } from '../../../shared/api/mappers'
import { useAsyncData } from '../../../shared/hooks/useAsyncData'
import { Badge } from '../../../shared/ui/Badge'
import { Button, ButtonLink } from '../../../shared/ui/Button'
import { TextareaField } from '../../../shared/ui/FormField'
import { PageHeader } from '../../../shared/ui/PageHeader'
import { StatusMessage } from '../../../shared/ui/StatusMessage'

function statusTone(status: ContractStatus): StatusTone {
  if (status === 'Active' || status === 'OwnerApproved') {
    return 'success'
  }

  if (status === 'Draft' || status === 'PendingSignature' || status === 'Scheduled') {
    return 'warning'
  }

  if (status === 'Terminated' || status === 'Expired') {
    return 'danger'
  }

  return 'neutral'
}

function formatDate(value?: string) {
  if (!value) {
    return '-'
  }

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('az-AZ')
}

function formatMoney(value?: number) {
  return `${Number(value || 0).toFixed(2)} AZN`
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
    return 'Restoran sahibi müqaviləni təsdiqləyib. Başlama tarixi gələcəkdirsə aktivləşdirmədən sonra müqavilə planlaşdırılmış statusa düşəcək.'
  }

  if (contract.status === 'Scheduled') {
    return 'Müqavilə planlaşdırılıb. Başlama tarixi çatanda sistem onu avtomatik aktiv edəcək.'
  }

  if (contract.status === 'Active') {
    return 'Müqavilə aktivdir. Lazım olarsa ləğv əməliyyatı icra edilə bilər.'
  }

  return 'Bu müqavilə üzrə aktiv əməliyyat yoxdur.'
}

function contractFileName(contract: RestaurantContract) {
  const rawName = contract.fileName || `${contract.contractNumber || `contract-${contract.id}`}.pdf`
  return rawName.replace(/[\\/:*?"<>|]/g, '-')
}

async function isPdfBlob(blob: Blob) {
  if (blob.type.toLowerCase().includes('pdf')) {
    return true
  }

  const signature = await blob.slice(0, 5).text().catch(() => '')
  return signature === '%PDF-'
}

export function ContractDetailPage() {
  const { contractId = '' } = useParams()
  const [reloadKey, setReloadKey] = useState(0)
  const [hasAcceptedContractTerms, setHasAcceptedContractTerms] = useState(false)
  const [acceptanceText, setAcceptanceText] = useState('Müqaviləni oxudum və şərtlərini qəbul edirəm.')
  const [actionError, setActionError] = useState('')
  const [actionErrorDetails, setActionErrorDetails] = useState<ApiErrorDetail[]>([])
  const [actionName, setActionName] = useState('')
  const [fileError, setFileError] = useState('')
  const [fileErrorDetails, setFileErrorDetails] = useState<ApiErrorDetail[]>([])
  const [isOpeningFile, setIsOpeningFile] = useState(false)
  const [isDownloadingFile, setIsDownloadingFile] = useState(false)
  const [previewUrl, setPreviewUrl] = useState('')
  const { data: record, isLoading } = useAsyncData(() => ecafeApi.contracts.get(contractId), null, [contractId, reloadKey])
  const contract = record?.contract

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }
    }
  }, [previewUrl])

  async function runAction(name: string, action: () => Promise<unknown>) {
    setActionError('')
    setActionErrorDetails([])
    setActionName(name)
    try {
      await action()
      window.dispatchEvent(new Event('ecafe:notifications-refresh'))
      setReloadKey((value) => value + 1)
    } catch (err) {
      const feedback = normalizeCaughtApiError(err, 'Əməliyyat icra olunmadı.')
      setActionError(feedback.message)
      setActionErrorDetails(feedback.details)
    } finally {
      setActionName('')
    }
  }

  async function openContractFile() {
    if (!contract?.fileUrl) {
      return
    }

    setFileError('')
    setFileErrorDetails([])
    setIsOpeningFile(true)

    try {
      const blob = await ecafeApi.files.viewBlob(contract.fileUrl)
      if (!(await isPdfBlob(blob))) {
        setFileError('Bu müqavilə sənədi PDF formatında deyil. Faylı yükləyin və ya müqaviləni yenidən yaradın.')
        return
      }

      const previewBlob = blob.type.toLowerCase().includes('pdf') ? blob : new Blob([blob], { type: 'application/pdf' })
      const objectUrl = URL.createObjectURL(previewBlob)
      setPreviewUrl((currentUrl) => {
        if (currentUrl) {
          URL.revokeObjectURL(currentUrl)
        }

        return objectUrl
      })
    } catch (err) {
      const feedback = normalizeCaughtApiError(err, 'Müqavilə sənədi açılmadı.')
      setFileError(feedback.message)
      setFileErrorDetails(feedback.details)
    } finally {
      setIsOpeningFile(false)
    }
  }

  async function downloadContractFile() {
    const fileUrl = contract?.fileDownloadUrl || contract?.fileUrl
    if (!contract || !fileUrl) {
      return
    }

    setFileError('')
    setFileErrorDetails([])
    setIsDownloadingFile(true)

    try {
      const blob = await ecafeApi.files.downloadBlob(fileUrl)
      const objectUrl = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = objectUrl
      link.download = contractFileName(contract)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000)
    } catch (err) {
      const feedback = normalizeCaughtApiError(err, 'Müqavilə sənədi yüklənmədi.')
      setFileError(feedback.message)
      setFileErrorDetails(feedback.details)
    } finally {
      setIsDownloadingFile(false)
    }
  }

  function closePreview() {
    setPreviewUrl((currentUrl) => {
      if (currentUrl) {
        URL.revokeObjectURL(currentUrl)
      }

      return ''
    })
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
        description={record?.restaurantName || '-'}
        action={<ButtonLink to="/admin/contracts" variant="secondary">Siyahıya qayıt</ButtonLink>}
      />

      <section className="detail-panel contract-detail-panel">
        <div className="contract-status-line">
          <Badge tone={statusTone(contract.status)}>{contractStatusLabel(contract)}</Badge>
          {contract.fileUrl ? (
            <div className="contract-file-actions">
              <button className="contract-file-link" disabled={isOpeningFile} onClick={openContractFile} type="button">
                <Eye size={18} />
                {isOpeningFile ? 'Açılır...' : 'Bax'}
              </button>
              <button className="contract-file-link" disabled={isDownloadingFile} onClick={downloadContractFile} type="button">
                <Download size={18} />
                {isDownloadingFile ? 'Yüklənir...' : 'Yüklə'}
              </button>
            </div>
          ) : (
            <span className="contract-file-link muted">
              <FileText size={18} />
              Sənəd hələ hazır deyil
            </span>
          )}
        </div>

        {previewUrl ? (
          <div className="contract-preview-panel">
            <div className="contract-preview-header">
              <div>
                <span className="eyebrow">Sənədə baxış</span>
                <h2>{contract.fileName || contract.contractNumber || 'Müqavilə sənədi'}</h2>
              </div>
              <Button variant="secondary" onClick={closePreview} type="button">
                Bağla
              </Button>
            </div>
            <iframe src={previewUrl} title="Müqavilə sənədi" />
          </div>
        ) : null}

        <dl>
          <div>
            <dt>Restoran</dt>
            <dd>{record?.restaurantName || '-'}</dd>
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
            <dt>Məbləğ</dt>
            <dd>{formatMoney(contract.amount)}</dd>
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
            <dt>Xatırlatma</dt>
            <dd>{contract.expiryReminderDaysBefore || 1} gün əvvəl</dd>
          </div>
          <div>
            <dt>Xatırlatma vaxtı</dt>
            <dd>{formatDate(contract.expiryReminderAt)}</dd>
          </div>
          <div>
            <dt>Təsdiqləyən</dt>
            <dd>{contract.signedByUserName || '-'}</dd>
          </div>
          <div>
            <dt>Təsdiq vaxtı</dt>
            <dd>{formatDate(contract.signedAt)}</dd>
          </div>
          <div>
            <dt>Fayl</dt>
            <dd>{contract.fileId ? `#${contract.fileId}` : '-'}</dd>
          </div>
        </dl>
        {fileError ? <StatusMessage details={fileErrorDetails} tone="danger">{fileError}</StatusMessage> : null}
      </section>

      <section className="contract-action-panel">
        <div>
          <h2>Növbəti əməliyyat</h2>
          <p>{nextActionText(contract, availableActions)}</p>
        </div>

        {sendForSignatureAction ? (
          <Button
            disabled={isBusy}
            onClick={() => runAction('send', () => ecafeApi.contracts.executeAction({ action: sendForSignatureAction }))}
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
                  ecafeApi.contracts.executeAction({
                    action: approveAction,
                    body: {
                      restaurantId: Number(contract.restaurantId),
                      contractId: Number(contract.id),
                      hasAcceptedContractTerms,
                      acceptanceText,
                    },
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
            onClick={() => runAction('activate', () => ecafeApi.contracts.executeAction({ action: activateAction }))}
          >
            <ShieldCheck size={18} />
            {actionName === 'activate' ? 'Aktivləşdirilir...' : activateAction.label}
          </Button>
        ) : null}

        {terminateAction ? (
          <Button
            disabled={isBusy}
            onClick={() => runAction('terminate', () => ecafeApi.contracts.executeAction({ action: terminateAction }))}
            variant="danger"
          >
            <XCircle size={18} />
            {actionName === 'terminate' ? 'Ləğv edilir...' : terminateAction.label}
          </Button>
        ) : null}

        {!hasVisibleAction ? <p className="muted-text">Sizin rolunuz üçün bu statusda icra ediləcək əməliyyat yoxdur.</p> : null}
        {actionError ? <StatusMessage details={actionErrorDetails} tone="danger">{actionError}</StatusMessage> : null}
      </section>
    </main>
  )
}
