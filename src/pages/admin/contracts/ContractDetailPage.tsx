import { i18n } from '../../../shared/i18n/i18n'
import { Ban, CheckCircle2, Download, Eye, FileText, Send, ShieldCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { ReservationReasonDialog } from '../../../features/reservations/ReservationReasonDialog'
import type { ContractStatus, RestaurantContract, StatusTone, WorkflowAction } from '../../../entities/types'
import { ecafeApi } from '../../../shared/api/ecafeApi'
import { normalizeCaughtApiError, type ApiErrorDetail } from '../../../shared/api/httpClient'
import { contractStatusLabel } from '../../../shared/api/mappers'
import { useKeyedAsyncData } from '../../../shared/hooks/useAsyncData'
import { Badge } from '../../../shared/ui/Badge'
import { Button, ButtonLink } from '../../../shared/ui/Button'
import { TextareaField } from '../../../shared/ui/FormField'
import { PageHeader } from '../../../shared/ui/PageHeader'
import { StatusMessage } from '../../../shared/ui/StatusMessage'
import { getCurrentLanguage } from '../../../shared/i18n/i18n'
import { getIntlLocale } from '../../../shared/i18n/language'

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
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(getIntlLocale(getCurrentLanguage()))
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
  const { data: record, isLoading } = useKeyedAsyncData(
    () => ecafeApi.contracts.get(contractId, restaurantIdFromQuery),
    null,
    `${restaurantIdFromQuery || ''}:${contractId}`,
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
        <p className="online-only">{i18n.t('ui.pages.admin.contracts.contract_detail_page.muqavile_melumatlari_yuklenir_ddd94c')}</p>
      </main>
    )
  }

  if (!contract) {
    return (
      <main className="admin-page narrow contract-detail-page">
        <PageHeader
          eyebrow={i18n.t('ui.pages.admin.contracts.contract_detail_page.muqavile_e125c2')}
          title={i18n.t('ui.pages.admin.contracts.contract_detail_page.muqavile_tapilmadi_c0fea3')}
          description={i18n.t('ui.pages.admin.contracts.contract_detail_page.bu_muqavile_silinmis_ola_biler_ve_ya_c_9a34a4')}
          action={<ButtonLink to="/admin/contracts" variant="secondary">{i18n.t('ui.pages.admin.contracts.contract_detail_page.siyahiya_qayit_f779ce')}</ButtonLink>}
        />
        <StatusMessage tone="warning">{i18n.t('ui.pages.admin.contracts.contract_detail_page.bildirisden_kecid_etmisinizse_restoran_90d1ee')}</StatusMessage>
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
        eyebrow={i18n.t('ui.pages.admin.contracts.contract_detail_page.muqavile_e125c2')}
        title={contract.contractNumber || `Müqavilə #${contract.id}`}
        description={record?.restaurantName || '-'}
        action={<ButtonLink to="/admin/contracts" variant="secondary">{i18n.t('ui.pages.admin.contracts.contract_detail_page.siyahiya_qayit_f779ce')}</ButtonLink>}
      />

      <section className="detail-panel contract-detail-panel">
        <div className="contract-status-line">
          <Badge tone={statusTone(contract.status)}>{contractStatusLabel(contract)}</Badge>
          {contract.fileUrl ? (
            <div className="contract-file-actions">
              <button className="contract-file-link contract-preview-action" disabled={isOpeningFile} onClick={openContractFile} type="button">
                <Eye size={18} />
                {isOpeningFile ?i18n.t('ui.pages.admin.contracts.contract_detail_page.acilir_5af86a') :i18n.t('ui.pages.admin.contracts.contract_detail_page.bax_215771')}
              </button>
              <button className="contract-file-link" disabled={isDownloadingFile} onClick={downloadContractFile} type="button">
                <Download size={18} />
                {isDownloadingFile ?i18n.t('ui.pages.admin.contracts.contract_detail_page.yuklenir_e038b0') :i18n.t('ui.pages.admin.contracts.contract_detail_page.yukle_71acbb')}
              </button>
            </div>
          ) : (
            <span className="contract-file-link muted">
              <FileText size={18} />
              {i18n.t('ui.pages.admin.contracts.contract_detail_page.sened_hele_hazir_deyil_3cc353')}
            </span>
          )}
        </div>

        <dl>
          <div>
            <dt>{i18n.t('ui.pages.admin.contracts.contract_detail_page.restoran_c4df56')}</dt>
            <dd>{record?.restaurantName || '-'}</dd>
          </div>
          <div>
            <dt>{i18n.t('ui.pages.admin.contracts.contract_detail_page.baslama_tarixi_0b7c63')}</dt>
            <dd>{formatDate(contract.startDate)}</dd>
          </div>
          <div>
            <dt>{i18n.t('ui.pages.admin.contracts.contract_detail_page.bitme_tarixi_5ab26f')}</dt>
            <dd>{formatDate(contract.endDate)}</dd>
          </div>
          <div>
            <dt>{i18n.t('ui.pages.admin.contracts.contract_detail_page.mebleg_3d95ed')}</dt>
            <dd>{formatMoney(contract.amount)}</dd>
          </div>
          <div>
            <dt>{i18n.t('ui.pages.admin.contracts.contract_detail_page.komissiya_08e231')}</dt>
            <dd>{contract.commissionPercent}%</dd>
          </div>
          <div>
            <dt>{i18n.t('ui.pages.admin.contracts.contract_detail_page.hesablasma_dovru_346e68')}</dt>
            <dd>{contract.settlementPeriod || '-'} {i18n.t('ui.pages.admin.contracts.contract_detail_page.gun_c1fc8f')}</dd>
          </div>
          <div>
            <dt>{i18n.t('ui.pages.admin.contracts.contract_detail_page.odenis_961ab1')}</dt>
            <dd>{i18n.t('ui.pages.admin.contracts.contract_detail_page.fiziki_offline_9cebc6')}</dd>
          </div>
          <div>
            <dt>{i18n.t('ui.pages.admin.contracts.contract_detail_page.xatirlatma_75c7fe')}</dt>
            <dd>{contract.expiryReminderDaysBefore || 1} {i18n.t('ui.pages.admin.contracts.contract_detail_page.gun_evvel_26a050')}</dd>
          </div>
          <div>
            <dt>{i18n.t('ui.pages.admin.contracts.contract_detail_page.xatirlatma_vaxti_1ae40e')}</dt>
            <dd>{formatDate(contract.expiryReminderAt)}</dd>
          </div>
          <div>
            <dt>{i18n.t('ui.pages.admin.contracts.contract_detail_page.tesdiqleyen_ce3fd8')}</dt>
            <dd>{contract.signedByUserName || '-'}</dd>
          </div>
          <div>
            <dt>{i18n.t('ui.pages.admin.contracts.contract_detail_page.tesdiq_vaxti_c92ed1')}</dt>
            <dd>{formatDate(contract.signedAt)}</dd>
          </div>
          <div>
            <dt>{i18n.t('ui.pages.admin.contracts.contract_detail_page.fayl_fec5a1')}</dt>
            <dd>{contract.fileId ? `#${contract.fileId}` : '-'}</dd>
          </div>
        </dl>
        {fileError ? <StatusMessage details={fileErrorDetails} tone="danger">{fileError}</StatusMessage> : null}
      </section>

      {previewUrl ? (
        <section className="contract-preview-panel" aria-label={i18n.t('ui.pages.admin.contracts.contract_detail_page.muqavile_pdf_baxisi_2651fc')}>
          <div className="contract-preview-header">
            <div>
              <span className="eyebrow">{i18n.t('ui.pages.admin.contracts.contract_detail_page.senede_baxis_cd2328')}</span>
              <h2>{contract.contractNumber || `Müqavilə #${contract.id}`}</h2>
            </div>
            <Button onClick={closePreview} type="button" variant="secondary">{i18n.t('ui.pages.admin.contracts.contract_detail_page.bagla_c1cf91')}</Button>
          </div>
          <iframe src={previewUrl} title={`${contract.contractNumber || `Müqavilə #${contract.id}`} sənədi`} />
        </section>
      ) : null}

      <section className="contract-action-panel">
        <div>
          <h2>{i18n.t('ui.pages.admin.contracts.contract_detail_page.novbeti_emeliyyat_87fa70')}</h2>
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
              <span>{i18n.t('ui.pages.admin.contracts.contract_detail_page.muqavileni_oxudum_ve_sertlerini_qebul__6ce884')}</span>
            </label>
            <TextareaField
              label={i18n.t('ui.pages.admin.contracts.contract_detail_page.qebul_metni_5f1fd5')}
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
              {actionName === approveAction.code ?i18n.t('ui.pages.admin.contracts.contract_detail_page.tesdiqlenir_0105d3') : approveAction.label}
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
                {actionName === action.code ?i18n.t('ui.pages.admin.contracts.contract_detail_page.icra_olunur_e4744c') : action.label}
              </Button>
            ))}
          </div>
        ) : null}

        {!hasVisibleAction ? <p className="muted-text">{i18n.t('ui.pages.admin.contracts.contract_detail_page.sizin_rolunuz_ucun_bu_statusda_icra_ed_d41c51')}</p> : null}
        {actionError ? <StatusMessage details={actionErrorDetails} tone="danger">{actionError}</StatusMessage> : null}
      </section>
      <ReservationReasonDialog
        confirmLabel={pendingAction?.label || 'Təsdiqlə'}
        description={i18n.t('ui.pages.admin.contracts.contract_detail_page.bu_emeliyyat_muqavilenin_cari_statusu__a68380')}
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
        title={i18n.t('ui.pages.admin.contracts.contract_detail_page.emeliyyati_tesdiqleyirsiniz_306a81')}
      />
    </main>
  )
}
