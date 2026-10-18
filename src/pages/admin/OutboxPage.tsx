import { i18n } from '../../shared/i18n/i18n'
import { useMemo, useState, type ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, Clock3, Eye, RefreshCw, RotateCcw, SlidersHorizontal, X } from 'lucide-react'
import type { OutboxMessage, StatusTone } from '../../entities/types'
import { ecafeApi } from '../../shared/api/ecafeApi'
import { normalizeCaughtApiError } from '../../shared/api/httpClient'
import { useAsyncData, useKeyedAsyncData } from '../../shared/hooks/useAsyncData'
import { Badge } from '../../shared/ui/Badge'
import { SelectField, TextField } from '../../shared/ui/FormField'
import { PageHeader } from '../../shared/ui/PageHeader'
import { PaginationControls } from '../../shared/ui/PaginationControls'
import { StatusMessage } from '../../shared/ui/StatusMessage'
import { getCurrentLanguage } from '../../shared/i18n/i18n'
import { getIntlLocale } from '../../shared/i18n/language'

const defaultPageSize = 10
const sentStatusId = 3
const failedStatusId = 4
const emailOutboxEventType = 'EmailNotificationRequested'
const smsOutboxEventType = 'SmsNotificationRequested'

function isLegacySms(message: OutboxMessage) {
  return message.eventType === smsOutboxEventType
}

function canRetry(message: OutboxMessage) {
  return message.eventType === emailOutboxEventType && message.statusId === failedStatusId
}

function channelLabel(message: OutboxMessage) {
  return isLegacySms(message) ? 'SMS arxivi' : message.channel
}

type OutboxFilters = {
  search: string
  statusId: string
  channelId: string
  dateFrom: string
  dateTo: string
}

const emptyOutboxFilters: OutboxFilters = {
  search: '',
  statusId: '',
  channelId: '',
  dateFrom: '',
  dateTo: '',
}

function formatDateTime(value?: string) {
  if (!value) {
    return '-'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat(getIntlLocale(getCurrentLanguage()), {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function statusTone(statusId: number): StatusTone {
  if (statusId === sentStatusId) {
    return 'success'
  }

  if (statusId === failedStatusId) {
    return 'danger'
  }

  return 'warning'
}

export function OutboxPage() {
  const [filters, setFilters] = useState<OutboxFilters>(emptyOutboxFilters)
  const [draftFilters, setDraftFilters] = useState<OutboxFilters>(emptyOutboxFilters)
  const [pageNumber, setPageNumber] = useState(1)
  const [pageSize, setPageSize] = useState(defaultPageSize)
  const [reloadKey, setReloadKey] = useState(0)
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [actionMessage, setActionMessage] = useState('')
  const [actionError, setActionError] = useState('')
  const [selectedMessage, setSelectedMessage] = useState<OutboxMessage | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [isDetailLoading, setIsDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')

  const query = useMemo(
    () => ({
      search: filters.search,
      statusId: filters.statusId,
      channelId: filters.channelId,
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
      pageNumber,
      pageSize,
    }),
    [filters, pageNumber, pageSize],
  )

  const { data: statuses } = useAsyncData(() => ecafeApi.lookups.outboxStatuses(), [], [])
  const { data: channels } = useAsyncData(() => ecafeApi.lookups.notificationChannels(), [], [])
  const { data: messagePage, error, isLoading } = useKeyedAsyncData(() => ecafeApi.outbox.page(query), {
    items: [],
    pageIndex: 1,
    totalPages: 1,
    totalCount: 0,
    hasPreviousPage: false,
    hasNextPage: false,
  }, JSON.stringify(query), [query, reloadKey])

  const pendingCount = messagePage.items.filter((message) => message.statusId !== sentStatusId && message.statusId !== failedStatusId).length
  const sentCount = messagePage.items.filter((message) => message.statusId === sentStatusId).length
  const failedCount = messagePage.items.filter((message) => message.statusId === failedStatusId).length
  const retryLimit = messagePage.items[0]?.maxRetryCount ?? 5

  function updateFilter<K extends keyof OutboxFilters>(key: K, value: OutboxFilters[K]) {
    setFilters((current) => ({ ...current, [key]: value }))
    setPageNumber(1)
  }

  function openFilterPanel() {
    setDraftFilters(filters)
    setIsFilterOpen((value) => !value)
  }

  function updateDraftFilter<K extends keyof OutboxFilters>(key: K, value: OutboxFilters[K]) {
    setDraftFilters((current) => ({ ...current, [key]: value }))
  }

  function applyFilters() {
    setFilters((current) => ({ ...current, ...draftFilters, search: current.search }))
    setPageNumber(1)
    setIsFilterOpen(false)
  }

  function clearFilters() {
    setFilters((current) => ({ ...emptyOutboxFilters, search: current.search }))
    setDraftFilters(emptyOutboxFilters)
    setPageNumber(1)
    setIsFilterOpen(false)
  }

  async function retryMessage(message: OutboxMessage) {
    if (!canRetry(message)) return

    setActionMessage('')
    setActionError('')

    try {
      const retriedMessage = await ecafeApi.outbox.retry(message.id)
      setActionMessage('Mesaj yenidən göndərilmə növbəsinə qaytarıldı.')
      setSelectedMessage((current) => (current?.id === retriedMessage.id ? retriedMessage : current))
      setReloadKey((value) => value + 1)
    } catch (err) {
      setActionError(normalizeCaughtApiError(err, 'Mesaj yenidən növbəyə qaytarılmadı.').message)
    }
  }

  async function openMessageDetail(message: OutboxMessage) {
    setSelectedMessage(message)
    setIsDetailOpen(true)
    setIsDetailLoading(true)
    setDetailError('')

    try {
      const detail = await ecafeApi.outbox.detail(message.id)
      setSelectedMessage(detail)
    } catch (err) {
      setDetailError(normalizeCaughtApiError(err, 'Mesaj detalları yüklənmədi.').message)
    } finally {
      setIsDetailLoading(false)
    }
  }

  return (
    <main className="admin-page">
      <PageHeader
        eyebrow={i18n.t('ui.pages.admin.outbox_page.admin_c1c224')}
        title={i18n.t('ui.pages.admin.outbox_page.sistem_mesajlari_fbe42b')}
      />

      <section className="outbox-metrics">
        <OutboxMetric icon={<Clock3 size={20} />} label={i18n.t('ui.pages.admin.outbox_page.bu_sehifede_gozleyen_f8cff0')} value={pendingCount} tone="warning" />
        <OutboxMetric icon={<AlertTriangle size={20} />} label={i18n.t('ui.pages.admin.outbox_page.bu_sehifede_ugursuz_e0f415')} value={failedCount} tone="danger" />
        <OutboxMetric icon={<CheckCircle2 size={20} />} label={i18n.t('ui.pages.admin.outbox_page.bu_sehifede_gonderilen_a20dbc')} value={sentCount} tone="success" />
        <OutboxMetric icon={<RefreshCw size={20} />} label={i18n.t('ui.pages.admin.outbox_page.retry_limiti_bd8da3')} value={retryLimit} tone="info" />
      </section>

      <section className="admin-panel outbox-toolbar">
        <TextField
          label={i18n.t('ui.pages.admin.outbox_page.axtaris_e782dd')}
          placeholder={i18n.t('ui.pages.admin.outbox_page.movzu_ve_ya_alici_uzre_axtar_3e117a')}
          value={filters.search}
          onChange={(event) => updateFilter('search', event.target.value)}
        />
        <div className="filter-popover">
          <button type="button" className="ui-button ui-button-secondary filter-trigger" onClick={openFilterPanel}>
            <SlidersHorizontal size={18} />
            {i18n.t('ui.pages.admin.outbox_page.filter_638e24')}
          </button>

          {isFilterOpen ? (
            <div className="filter-panel" role="dialog" aria-label={i18n.t('ui.pages.admin.outbox_page.sistem_mesajlari_filterleri_e22b39')}>
              <span>{i18n.t('ui.pages.admin.outbox_page.sirala_4437ec')}</span>
              <div className="filter-panel-grid">
                <SelectField label={i18n.t('ui.pages.admin.outbox_page.status_920e41')} value={draftFilters.statusId} onChange={(event) => updateDraftFilter('statusId', event.target.value)}>
                  <option value="">{i18n.t('ui.pages.admin.outbox_page.butun_statuslar_96a387')}</option>
                  {statuses.map((status) => (
                    <option key={status.id} value={status.id}>
                      {status.name}
                    </option>
                  ))}
                </SelectField>
                <SelectField label={i18n.t('ui.pages.admin.outbox_page.kanal_fe59ab')} value={draftFilters.channelId} onChange={(event) => updateDraftFilter('channelId', event.target.value)}>
                  <option value="">{i18n.t('ui.pages.admin.outbox_page.butun_kanallar_7420b6')}</option>
                  {channels.map((channel) => (
                    <option key={channel.id} value={channel.id}>
                      {channel.name}
                    </option>
                  ))}
                </SelectField>
                <TextField label={i18n.t('ui.pages.admin.outbox_page.baslangic_tarixi_3d5f27')} type="date" value={draftFilters.dateFrom} onChange={(event) => updateDraftFilter('dateFrom', event.target.value)} />
                <TextField label={i18n.t('ui.pages.admin.outbox_page.bitme_tarixi_5ab26f')} type="date" value={draftFilters.dateTo} onChange={(event) => updateDraftFilter('dateTo', event.target.value)} />
              </div>
              <div className="filter-panel-actions">
                <button type="button" className="ui-button ui-button-secondary" onClick={clearFilters}>{i18n.t('ui.pages.admin.outbox_page.temizle_1e4f85')}</button>
                <button type="button" className="ui-button ui-button-primary" onClick={applyFilters}>{i18n.t('ui.pages.admin.outbox_page.tetbiq_et_0c1bd1')}</button>
              </div>
            </div>
          ) : null}
        </div>
      </section>

      <section className="admin-panel">
        <div className="section-heading-row">
          <div>
            <span className="eyebrow">{i18n.t('ui.pages.admin.outbox_page.siyahi_3d2d8b')}</span>
            <h2>{i18n.t('ui.pages.admin.outbox_page.mesaj_tarixcesi_4d4d0a')}</h2>
          </div>
          <strong>{messagePage.totalCount} {i18n.t('ui.pages.admin.outbox_page.mesaj_90ccb7')}</strong>
        </div>

        {isLoading ? <p className="online-only">{i18n.t('ui.pages.admin.outbox_page.sistem_mesajlari_yuklenir_ec1a24')}</p> : null}
        {error ? <StatusMessage tone="danger">{error}</StatusMessage> : null}
        {actionMessage ? <StatusMessage tone="success">{actionMessage}</StatusMessage> : null}
        {actionError ? <StatusMessage tone="danger">{actionError}</StatusMessage> : null}

        <div className="outbox-table" role="table" aria-label={i18n.t('ui.pages.admin.outbox_page.sistem_mesajlari_fbe42b')}>
          <div className="outbox-table-head" role="row">
            <span>{i18n.t('ui.pages.admin.outbox_page.mesaj_1e8688')}</span>
            <span>{i18n.t('ui.pages.admin.outbox_page.kanal_fe59ab')}</span>
            <span>{i18n.t('ui.pages.admin.outbox_page.status_920e41')}</span>
            <span>{i18n.t('ui.pages.admin.outbox_page.retry_942087')}</span>
            <span>{i18n.t('ui.pages.admin.outbox_page.tarix_2dc57a')}</span>
            <span>{i18n.t('ui.pages.admin.outbox_page.qeyd_5579df')}</span>
            <span>{i18n.t('ui.pages.admin.outbox_page.emeliyyat_fc71e9')}</span>
          </div>

          {messagePage.items.map((message) => (
            <article className="outbox-table-row" key={message.id} role="row">
              <div className="outbox-message-cell" data-label={i18n.t('ui.pages.admin.outbox_page.mesaj_1e8688')}>
                <strong>{message.subject}</strong>
                <small>{message.recipient}</small>
              </div>
              <span data-label={i18n.t('ui.pages.admin.outbox_page.kanal_fe59ab')}>{channelLabel(message)}</span>
              <span data-label={i18n.t('ui.pages.admin.outbox_page.status_920e41')}>
                <Badge tone={statusTone(message.statusId)}>{message.status}</Badge>
              </span>
              <strong data-label={i18n.t('ui.pages.admin.outbox_page.retry_942087')}>
                {message.retryCount}/{message.maxRetryCount}
              </strong>
              <small data-label={i18n.t('ui.pages.admin.outbox_page.tarix_2dc57a')}>{formatDateTime(message.occurredAt)}</small>
              <small data-label={i18n.t('ui.pages.admin.outbox_page.qeyd_5579df')}>{message.lastError || (message.nextRetryAt ? `Növbəti cəhd: ${formatDateTime(message.nextRetryAt)}` :i18n.t('ui.pages.admin.outbox_page.problem_yoxdur_eaa4ea'))}</small>
              <div className="ui-row-actions" data-label={i18n.t('ui.pages.admin.outbox_page.emeliyyat_fc71e9')}>
                <button
                  type="button"
                  className="ui-button ui-button-secondary action-icon-button"
                  aria-label={`${message.subject} detalına bax`}
                  title={i18n.t('ui.pages.admin.outbox_page.detala_bax_16750f')}
                  onClick={() => void openMessageDetail(message)}
                >
                  <Eye size={18} />
                </button>
                {canRetry(message) ? (
                  <button
                    type="button"
                    className="ui-button ui-button-secondary action-icon-button"
                    aria-label={i18n.t('ui.pages.admin.outbox_page.yeniden_gonder_6a32e3')}
                    title={i18n.t('ui.pages.admin.outbox_page.yeniden_gonder_6a32e3')}
                    onClick={() => void retryMessage(message)}
                  >
                    <RotateCcw size={18} />
                  </button>
                ) : null}
              </div>
            </article>
          ))}

          {!isLoading && !error && messagePage.items.length === 0 ? <p className="ui-table-empty">{i18n.t('ui.pages.admin.outbox_page.bu_filterlere_uygun_sistem_mesaji_tapi_066ccd')}</p> : null}
        </div>

        <PaginationControls
          ariaLabel={i18n.t('ui.pages.admin.outbox_page.sistem_mesajlari_sehifeleme_ff033f')}
          hasNextPage={messagePage.hasNextPage}
          hasPreviousPage={messagePage.hasPreviousPage}
          pageIndex={messagePage.pageIndex}
          pageSize={pageSize}
          totalCount={messagePage.totalCount}
          totalPages={messagePage.totalPages}
          onPageChange={setPageNumber}
          onPageSizeChange={(value) => {
            setPageSize(value)
            setPageNumber(1)
          }}
        />
      </section>
      {isDetailOpen ? (
        <OutboxDetailModal
          isLoading={isDetailLoading}
          error={detailError}
          message={selectedMessage}
          onClose={() => {
            setIsDetailOpen(false)
            setSelectedMessage(null)
            setDetailError('')
          }}
          onRetry={(message) => void retryMessage(message)}
        />
      ) : null}
    </main>
  )
}

function OutboxMetric({ icon, label, tone, value }: { icon: ReactNode; label: string; tone: StatusTone; value: number }) {
  return (
    <article className={`outbox-metric outbox-metric-${tone}`}>
      <span>{icon}</span>
      <div>
        <small>{label}</small>
        <strong>{value}</strong>
      </div>
    </article>
  )
}

function OutboxDetailModal({
  error,
  isLoading,
  message,
  onClose,
  onRetry,
}: {
  error: string
  isLoading: boolean
  message: OutboxMessage | null
  onClose: () => void
  onRetry: (message: OutboxMessage) => void
}) {
  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <section className="audit-detail-modal" role="dialog" aria-modal="true" aria-label={i18n.t('ui.pages.admin.outbox_page.sistem_mesaji_detallari_c8c63c')} onClick={(event) => event.stopPropagation()}>
        <div className="audit-detail-header">
          <div>
            <span className="eyebrow">{i18n.t('ui.pages.admin.outbox_page.sistem_mesaji_05e252')}</span>
            <h2>{message?.subject || 'Mesaj detalı'}</h2>
          </div>
          <button type="button" className="ui-button ui-button-secondary action-icon-button" aria-label={i18n.t('ui.pages.admin.outbox_page.bagla_c1cf91')} title={i18n.t('ui.pages.admin.outbox_page.bagla_c1cf91')} onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {isLoading ? <p className="online-only">{i18n.t('ui.pages.admin.outbox_page.mesaj_detallari_yuklenir_79bde6')}</p> : null}
        {error ? <StatusMessage tone="danger">{error}</StatusMessage> : null}

        {message ? (
          <>
            <div className="audit-detail-summary">
              <DetailItem label={i18n.t('ui.pages.admin.outbox_page.status_920e41')} value={message.status} />
              <DetailItem label={i18n.t('ui.pages.admin.outbox_page.kanal_fe59ab')} value={channelLabel(message)} />
              <DetailItem label={i18n.t('ui.pages.admin.outbox_page.alici_15d1ef')} value={message.recipient} />
              <DetailItem label={i18n.t('ui.pages.admin.outbox_page.alici_adi_c23646')} value={message.recipientName || '-'} />
              <DetailItem label={i18n.t('ui.pages.admin.outbox_page.retry_942087')} value={`${message.retryCount}/${message.maxRetryCount}`} />
              <DetailItem label={i18n.t('ui.pages.admin.outbox_page.yaranma_vaxti_b50225')} value={formatDateTime(message.occurredAt)} />
              <DetailItem label={i18n.t('ui.pages.admin.outbox_page.gonderilme_vaxti_d0a4f5')} value={formatDateTime(message.processedAt)} />
              <DetailItem label={i18n.t('ui.pages.admin.outbox_page.novbeti_cehd_9588ee')} value={formatDateTime(message.nextRetryAt)} />
              <DetailItem label={i18n.t('ui.pages.admin.outbox_page.event_4e1f49')} value={message.eventType} />
              <DetailItem label={i18n.t('ui.pages.admin.outbox_page.aggregate_3c9193')} value={`${message.aggregateType} #${message.aggregateId}`} />
              <DetailItem label={i18n.t('ui.pages.admin.outbox_page.elaqeli_obyekt_920798')} value={message.relatedEntityType ? `${message.relatedEntityType} #${message.relatedEntityId ?? '-'}` : '-'} />
            </div>

            <div className="audit-detail-changes">
              <span className="eyebrow">{i18n.t('ui.pages.admin.outbox_page.qeyd_5579df')}</span>
              <div className="audit-detail-change">
                <strong>{i18n.t('ui.pages.admin.outbox_page.son_xeta_60402c')}</strong>
                <span>{message.lastError || 'Problem yoxdur'}</span>
              </div>
            </div>

            {canRetry(message) ? (
              <button type="button" className="ui-button ui-button-primary" onClick={() => onRetry(message)}>
                <RotateCcw size={18} />
                {i18n.t('ui.pages.admin.outbox_page.yeniden_gonder_6a32e3')}
              </button>
            ) : null}
          </>
        ) : null}
      </section>
    </div>
  )
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}
