import { Ban, CheckCircle2, Download, Eye, FileText, Send, ShieldCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { ReservationReasonDialog } from '../../../features/reservations/ReservationReasonDialog'
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

function nextActionText(actions: WorkflowAction[]) {
  return actions[0]?.label || 'Bu statusda icra ediləcək əməliyyat yoxdur.'
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
  const [searchParams] = useSearchParams()
  const restaurantIdFromQuery = searchParams.get('restaurantId') || undefined
  const [reloadKey, setReloadKey] = useState(0)
  const [hasAcceptedContractTerms, setHasAcceptedContractTerms] = useState(false)
  const [acceptanceText, setAcceptanceText] = useState('Müqaviləni oxudum və şərtlərini qəbul edirəm.')
  const [actionError, setActionError] = useState('')
  const [actionErrorDetails, setActionErrorDetails] = useState<ApiErrorDetail[]>([])
  const [actionName, setActionName] = useState('')
  const [pendingAction, setPendingAction] = useState<WorkflowAction | null>(null)
  const [fileError, setFileError] = useState('')
  const [fileErrorDetails, setFileErrorDetails] = useState<ApiErrorDetail[]>([])
  const [isOpeningFile, setIsOpeningFile] = useState(false)
  const [isDownloadingFile, setIsDownloadingFile] = useState(false)
  const [previewUrl, setPreviewUrl] = useState('')
  const { data: record, isLoading } = useAsyncData(
    () => ecafeApi.contracts.get(contractId, restaurantIdFromQuery),
    null,
    [contractId, restaurantIdFromQuery, reloadKey],
  )
  const contract = record?.contract

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }
    }
  }, [previewUrl])

  async function runAction(action: WorkflowAction, body?: unknown, onSuccess?: () => void) {
    setActionError('')
    setActionErrorDetails([])
    setActionName(action.code)
    try {
      await ecafeApi.workflow.executeAction({ action, body })
      onSuccess?.()
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

  function requestAction(action: WorkflowAction) {
    setActionError('')
    if (action.requiresConfirmation) {
      setPendingAction(action)
      return
    }

    void runAction(action)
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

  if (isLoading) {
    return (
      <main className="admin-page narrow contract-detail-page">
        <p className="online-only">Müqavilə məlumatları yüklənir...</p>
      </main>
    )
  }

  if (!contract) {
    return (
      <main className="admin-page narrow contract-detail-page">
        <PageHeader
          eyebrow="Müqavilə"
          title="Müqavilə tapılmadı"
          description="Bu müqavilə silinmiş ola bilər və ya cari hesabınızın həmin restorana icazəsi yoxdur."
          action={<ButtonLink to="/admin/contracts" variant="secondary">Siyahıya qayıt</ButtonLink>}
        />
        <StatusMessage tone="warning">
          Bildirişdən keçid etmisinizsə, restoran icazələriniz yenilənməyibsə sistemdən çıxıb yenidən daxil olun.
        </StatusMessage>
      </main>
    )
  }

  const isBusy = actionName !== ''
  const availableActions = contract.availableActions ?? []
  const approveAction = availableActions.find((action) => action.code === 'approve')
  const genericActions = availableActions.filter((action) => action.code !== 'approve')
  const hasVisibleAction = availableActions.length > 0

  function closePreview() {
    setPreviewUrl((currentUrl) => {
      if (currentUrl) {
        URL.revokeObjectURL(currentUrl)
      }

      return ''
    })
  }

  return (
    <main className="admin-page narrow contract-detail-page">
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
              <button className="contract-file-link contract-preview-action" disabled={isOpeningFile} onClick={openContractFile} type="button">
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

      {previewUrl ? (
        <section className="contract-preview-panel" aria-label="Müqavilə PDF baxışı">
          <div className="contract-preview-header">
            <div>
              <span className="eyebrow">Sənədə baxış</span>
              <h2>{contract.contractNumber || `Müqavilə #${contract.id}`}</h2>
            </div>
            <Button onClick={closePreview} type="button" variant="secondary">
              Bağla
            </Button>
          </div>
          <iframe src={previewUrl} title={`${contract.contractNumber || `Müqavilə #${contract.id}`} sənədi`} />
        </section>
      ) : null}

      <section className="contract-action-panel">
        <div>
          <h2>Növbəti əməliyyat</h2>
          <p>{nextActionText(availableActions)}</p>
        </div>

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
                runAction(approveAction, {
                  restaurantId: Number(contract.restaurantId),
                  contractId: Number(contract.id),
                  hasAcceptedContractTerms,
                  acceptanceText,
                })
              }
            >
              <CheckCircle2 size={18} />
              {actionName === approveAction.code ? 'Təsdiqlənir...' : approveAction.label}
            </Button>
          </div>
        ) : null}

        {genericActions.length > 0 ? (
          <div className="action-row">
            {genericActions.map((action) => (
              <Button
                disabled={isBusy}
                key={`${action.code}-${action.endpoint}`}
                onClick={() => requestAction(action)}
                variant={action.requiresConfirmation ? 'danger' : 'primary'}
              >
                {action.code === 'sendForSignature' ? <Send size={18} /> : action.code === 'activate' ? <ShieldCheck size={18} /> : action.requiresConfirmation ? <Ban size={18} /> : <CheckCircle2 size={18} />}
                {actionName === action.code ? 'İcra olunur...' : action.label}
              </Button>
            ))}
          </div>
        ) : null}

        {!hasVisibleAction ? <p className="muted-text">Sizin rolunuz üçün bu statusda icra ediləcək əməliyyat yoxdur.</p> : null}
        {actionError ? <StatusMessage details={actionErrorDetails} tone="danger">{actionError}</StatusMessage> : null}
      </section>
      <ReservationReasonDialog
        confirmLabel={pendingAction?.label || 'Təsdiqlə'}
        description="Bu əməliyyat müqavilənin cari statusu və istifadəçi roluna uyğun icra ediləcək."
        error={pendingAction ? actionError : ''}
        isOpen={Boolean(pendingAction)}
        isSubmitting={Boolean(pendingAction && actionName === pendingAction.code)}
        onClose={() => setPendingAction(null)}
        onConfirm={(reason) => {
          if (!pendingAction) return
          void runAction(pendingAction, reason ? { reason } : undefined, () => setPendingAction(null))
        }}
        requireReason={pendingAction?.requiresReason || false}
        showReason={pendingAction?.requiresReason || false}
        title="Əməliyyatı təsdiqləyirsiniz?"
      />
    </main>
  )
}
