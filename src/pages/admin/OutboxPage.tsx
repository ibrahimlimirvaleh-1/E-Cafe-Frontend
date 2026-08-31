import { useMemo, useState, type ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, Clock3, Eye, RefreshCw, RotateCcw, SlidersHorizontal, X } from 'lucide-react'
import type { OutboxMessage, StatusTone } from '../../entities/types'
import { ecafeApi } from '../../shared/api/ecafeApi'
import { normalizeCaughtApiError } from '../../shared/api/httpClient'
import { useAsyncData } from '../../shared/hooks/useAsyncData'
import { Badge } from '../../shared/ui/Badge'
import { SelectField, TextField } from '../../shared/ui/FormField'
import { PageHeader } from '../../shared/ui/PageHeader'
import { PaginationControls } from '../../shared/ui/PaginationControls'
import { StatusMessage } from '../../shared/ui/StatusMessage'

const defaultPageSize = 10
const sentStatusId = 3
const failedStatusId = 4

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

  return new Intl.DateTimeFormat('az-AZ', {
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
  const { data: messagePage, error, isLoading } = useAsyncData(() => ecafeApi.outbox.page(query), {
    items: [],
    pageIndex: 1,
    totalPages: 1,
    totalCount: 0,
    hasPreviousPage: false,
    hasNextPage: false,
  }, [query, reloadKey])

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
        eyebrow="Admin"
        title="Sistem mesajları"
        description="Email və SMS mesajlarının göndərilmə vəziyyəti izlənilir."
      />

      <section className="outbox-metrics">
        <OutboxMetric icon={<Clock3 size={20} />} label="Bu səhifədə gözləyən" value={pendingCount} tone="warning" />
        <OutboxMetric icon={<AlertTriangle size={20} />} label="Bu səhifədə uğursuz" value={failedCount} tone="danger" />
        <OutboxMetric icon={<CheckCircle2 size={20} />} label="Bu səhifədə göndərilən" value={sentCount} tone="success" />
        <OutboxMetric icon={<RefreshCw size={20} />} label="Retry limiti" value={retryLimit} tone="info" />
      </section>

      <section className="admin-panel outbox-toolbar">
        <TextField
          label="Axtarış"
          placeholder="Mövzu və ya alıcı üzrə axtar..."
          value={filters.search}
          onChange={(event) => updateFilter('search', event.target.value)}
        />
        <div className="filter-popover">
          <button type="button" className="ui-button ui-button-secondary filter-trigger" onClick={openFilterPanel}>
            <SlidersHorizontal size={18} />
            Filter
          </button>

          {isFilterOpen ? (
            <div className="filter-panel" role="dialog" aria-label="Sistem mesajları filterləri">
              <span>Sırala</span>
              <div className="filter-panel-grid">
                <SelectField label="Status" value={draftFilters.statusId} onChange={(event) => updateDraftFilter('statusId', event.target.value)}>
                  <option value="">Bütün statuslar</option>
                  {statuses.map((status) => (
                    <option key={status.id} value={status.id}>
                      {status.name}
                    </option>
                  ))}
                </SelectField>
                <SelectField label="Kanal" value={draftFilters.channelId} onChange={(event) => updateDraftFilter('channelId', event.target.value)}>
                  <option value="">Bütün kanallar</option>
                  {channels.map((channel) => (
                    <option key={channel.id} value={channel.id}>
                      {channel.name}
                    </option>
                  ))}
                </SelectField>
                <TextField label="Başlanğıc tarixi" type="date" value={draftFilters.dateFrom} onChange={(event) => updateDraftFilter('dateFrom', event.target.value)} />
                <TextField label="Bitmə tarixi" type="date" value={draftFilters.dateTo} onChange={(event) => updateDraftFilter('dateTo', event.target.value)} />
              </div>
              <div className="filter-panel-actions">
                <button type="button" className="ui-button ui-button-secondary" onClick={clearFilters}>
                  Təmizlə
                </button>
                <button type="button" className="ui-button ui-button-primary" onClick={applyFilters}>
                  Tətbiq et
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </section>

      <section className="admin-panel">
        <div className="section-heading-row">
          <div>
            <span className="eyebrow">Siyahı</span>
            <h2>Göndərilmə növbəsi</h2>
          </div>
          <strong>{messagePage.totalCount} mesaj</strong>
        </div>

        {isLoading ? <p className="online-only">Sistem mesajları yüklənir...</p> : null}
        {error ? <StatusMessage tone="danger">{error}</StatusMessage> : null}
        {actionMessage ? <StatusMessage tone="success">{actionMessage}</StatusMessage> : null}
        {actionError ? <StatusMessage tone="danger">{actionError}</StatusMessage> : null}

        <div className="outbox-table" role="table" aria-label="Sistem mesajları">
          <div className="outbox-table-head" role="row">
            <span>Mesaj</span>
            <span>Kanal</span>
            <span>Status</span>
            <span>Retry</span>
            <span>Tarix</span>
            <span>Qeyd</span>
            <span>Əməliyyat</span>
          </div>

          {messagePage.items.map((message) => (
            <article className="outbox-table-row" key={message.id} role="row">
              <div className="outbox-message-cell" data-label="Mesaj">
                <strong>{message.subject}</strong>
                <small>{message.recipient}</small>
              </div>
              <span data-label="Kanal">{message.channel}</span>
              <span data-label="Status">
                <Badge tone={statusTone(message.statusId)}>{message.status}</Badge>
              </span>
              <strong data-label="Retry">
                {message.retryCount}/{message.maxRetryCount}
              </strong>
              <small data-label="Tarix">{formatDateTime(message.occurredAt)}</small>
              <small data-label="Qeyd">{message.lastError || (message.nextRetryAt ? `Növbəti cəhd: ${formatDateTime(message.nextRetryAt)}` : 'Problem yoxdur')}</small>
              <div className="ui-row-actions" data-label="Əməliyyat">
                <button
                  type="button"
                  className="ui-button ui-button-secondary action-icon-button"
                  aria-label={`${message.subject} detalına bax`}
                  title="Detala bax"
                  onClick={() => void openMessageDetail(message)}
                >
                  <Eye size={18} />
                </button>
                {message.statusId === failedStatusId ? (
                  <button
                    type="button"
                    className="ui-button ui-button-secondary action-icon-button"
                    aria-label="Yenidən göndər"
                    title="Yenidən göndər"
                    onClick={() => void retryMessage(message)}
                  >
                    <RotateCcw size={18} />
                  </button>
                ) : null}
              </div>
            </article>
          ))}

          {!isLoading && !error && messagePage.items.length === 0 ? <p className="ui-table-empty">Bu filterlərə uyğun sistem mesajı tapılmadı.</p> : null}
        </div>

        <PaginationControls
          ariaLabel="Sistem mesajları səhifələmə"
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
      <section className="audit-detail-modal" role="dialog" aria-modal="true" aria-label="Sistem mesajı detalları" onClick={(event) => event.stopPropagation()}>
        <div className="audit-detail-header">
          <div>
            <span className="eyebrow">Sistem mesajı</span>
            <h2>{message?.subject || 'Mesaj detalı'}</h2>
          </div>
          <button type="button" className="ui-button ui-button-secondary action-icon-button" aria-label="Bağla" title="Bağla" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {isLoading ? <p className="online-only">Mesaj detalları yüklənir...</p> : null}
        {error ? <StatusMessage tone="danger">{error}</StatusMessage> : null}

        {message ? (
          <>
            <div className="audit-detail-summary">
              <DetailItem label="Status" value={message.status} />
              <DetailItem label="Kanal" value={message.channel} />
              <DetailItem label="Alıcı" value={message.recipient} />
              <DetailItem label="Alıcı adı" value={message.recipientName || '-'} />
              <DetailItem label="Retry" value={`${message.retryCount}/${message.maxRetryCount}`} />
              <DetailItem label="Yaranma vaxtı" value={formatDateTime(message.occurredAt)} />
              <DetailItem label="Göndərilmə vaxtı" value={formatDateTime(message.processedAt)} />
              <DetailItem label="Növbəti cəhd" value={formatDateTime(message.nextRetryAt)} />
              <DetailItem label="Event" value={message.eventType} />
              <DetailItem label="Aggregate" value={`${message.aggregateType} #${message.aggregateId}`} />
              <DetailItem label="Əlaqəli obyekt" value={message.relatedEntityType ? `${message.relatedEntityType} #${message.relatedEntityId ?? '-'}` : '-'} />
            </div>

            <div className="audit-detail-changes">
              <span className="eyebrow">Qeyd</span>
              <div className="audit-detail-change">
                <strong>Son xəta</strong>
                <span>{message.lastError || 'Problem yoxdur'}</span>
              </div>
            </div>

            {message.statusId === failedStatusId ? (
              <button type="button" className="ui-button ui-button-primary" onClick={() => onRetry(message)}>
                <RotateCcw size={18} />
                Yenidən göndər
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
