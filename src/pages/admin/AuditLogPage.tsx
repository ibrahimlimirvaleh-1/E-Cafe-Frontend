import { useEffect, useMemo, useState } from 'react'
import { Eye, SlidersHorizontal, X } from 'lucide-react'
import type { AuditLogEntry } from '../../entities/types'
import { ecafeApi } from '../../shared/api/ecafeApi'
import { useAsyncData } from '../../shared/hooks/useAsyncData'
import { Badge } from '../../shared/ui/Badge'
import { SelectField, TextField } from '../../shared/ui/FormField'
import { PageHeader } from '../../shared/ui/PageHeader'
import { PaginationControls } from '../../shared/ui/PaginationControls'

const defaultPageSize = 10

type AuditFilters = {
  action: string
  dateFrom: string
  dateTo: string
}

const emptyAuditFilters: AuditFilters = {
  action: '',
  dateFrom: '',
  dateTo: '',
}

function toLocalDateTime(value: string) {
  if (!value) {
    return '-'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toLocaleString('az-AZ', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function AuditLogPage() {
  const [selectedRestaurantId, setSelectedRestaurantId] = useState('')
  const [pageNumber, setPageNumber] = useState(1)
  const [pageSize, setPageSize] = useState(defaultPageSize)
  const [filters, setFilters] = useState<AuditFilters>(emptyAuditFilters)
  const [draftFilters, setDraftFilters] = useState<AuditFilters>(emptyAuditFilters)
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null)
  const { data: restaurants } = useAsyncData(() => ecafeApi.restaurants.list(), [], [])
  const { data: auditActions } = useAsyncData(() => ecafeApi.lookups.auditActions(), [], [])
  const restaurantId = selectedRestaurantId || restaurants[0]?.id || ''
  const query = useMemo(
    () => ({
      action: filters.action,
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
      pageNumber,
      pageSize,
    }),
    [filters, pageNumber, pageSize],
  )
  const { data: logPage, isLoading } = useAsyncData(
    () =>
      restaurantId
        ? ecafeApi.auditLogs.page(restaurantId, query)
        : Promise.resolve({
            items: [],
            pageIndex: 1,
            totalPages: 1,
            totalCount: 0,
            hasPreviousPage: false,
            hasNextPage: false,
          }),
    {
      items: [],
      pageIndex: 1,
      totalPages: 1,
      totalCount: 0,
      hasPreviousPage: false,
      hasNextPage: false,
    },
    [restaurantId, query],
  )

  useEffect(() => {
    if (!selectedRestaurantId && restaurants[0]) {
      setSelectedRestaurantId(restaurants[0].id)
    }
  }, [restaurants, selectedRestaurantId])

  function resetPageAnd(setter: (value: string) => void, value: string) {
    setter(value)
    setPageNumber(1)
  }

  function openFilterPanel() {
    setDraftFilters(filters)
    setIsFilterOpen((value) => !value)
  }

  function updateDraftFilter<K extends keyof AuditFilters>(key: K, value: AuditFilters[K]) {
    setDraftFilters((current) => ({ ...current, [key]: value }))
  }

  function applyFilters() {
    setFilters(draftFilters)
    setPageNumber(1)
    setIsFilterOpen(false)
  }

  function clearFilters() {
    setFilters(emptyAuditFilters)
    setDraftFilters(emptyAuditFilters)
    setPageNumber(1)
    setIsFilterOpen(false)
  }

  return (
    <main className="admin-page">
      <PageHeader eyebrow="Admin" title="Audit loglar" />

      <section className="admin-panel audit-toolbar">
        <SelectField label="Restoran" required value={restaurantId} onChange={(event) => resetPageAnd(setSelectedRestaurantId, event.target.value)}>
          {restaurants.map((restaurant) => (
            <option key={restaurant.id} value={restaurant.id}>
              {restaurant.name}
            </option>
          ))}
        </SelectField>
        <div className="filter-popover">
          <button type="button" className="ui-button ui-button-secondary filter-trigger" onClick={openFilterPanel}>
            <SlidersHorizontal size={18} />
            Filter
          </button>

          {isFilterOpen ? (
            <div className="filter-panel" role="dialog" aria-label="Audit log filterləri">
              <span>Sırala</span>
              <div className="filter-panel-grid">
                <SelectField
                  label="Əməliyyat"
                  value={draftFilters.action}
                  onChange={(event) => updateDraftFilter('action', event.target.value)}
                >
                  <option value="">Bütün əməliyyatlar</option>
                  {auditActions.map((auditAction) => (
                    <option key={auditAction.code} value={auditAction.code}>
                      {auditAction.name}
                    </option>
                  ))}
                </SelectField>
                <TextField
                  label="Başlanğıc tarixi"
                  type="date"
                  value={draftFilters.dateFrom}
                  onChange={(event) => updateDraftFilter('dateFrom', event.target.value)}
                />
                <TextField
                  label="Bitmə tarixi"
                  type="date"
                  value={draftFilters.dateTo}
                  onChange={(event) => updateDraftFilter('dateTo', event.target.value)}
                />
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
            <h2>Əməliyyat tarixçəsi</h2>
          </div>
          <strong>{logPage.totalCount} log</strong>
        </div>
        {isLoading ? <p className="online-only">Audit loglar yüklənir...</p> : null}
        <div className="compact-list audit-list">
          <div className="audit-list-head" aria-hidden="true">
            <span>Əməliyyat</span>
            <span>Obyekt</span>
            <span>İstifadəçi</span>
            <span>Rol</span>
            <span>Tarix</span>
            <span>Baxış</span>
          </div>
          {logPage.items.map((log) => (
            <article key={log.id}>
              <div className="audit-action-cell">
                <strong>{log.actionDisplayName || log.action || 'Əməliyyat'}</strong>
              </div>
              <small>{log.entityDisplayName || `${log.entityName} #${log.entityId}`}</small>
              <div className="audit-user-cell">
                <Badge tone="info">{log.actorName || 'Sistem'}</Badge>
                {log.actorEmail ? <small>{log.actorEmail}</small> : null}
              </div>
              <small>{log.actorRoleName || '-'}</small>
              <small>{toLocalDateTime(log.occurredAt || log.createdAt)}</small>
              <button
                type="button"
                className="ui-button ui-button-secondary action-icon-button"
                aria-label={`${log.actionDisplayName || log.action || 'Audit log'} detalına bax`}
                title="Detala bax"
                onClick={() => setSelectedLog(log)}
              >
                <Eye size={18} />
              </button>
            </article>
          ))}
          {!isLoading && logPage.items.length === 0 ? <p className="online-only">Bu filterlərə uyğun audit log tapılmadı.</p> : null}
        </div>
        <PaginationControls
          ariaLabel="Audit log səhifələmə"
          hasNextPage={logPage.hasNextPage}
          hasPreviousPage={logPage.hasPreviousPage}
          pageIndex={logPage.pageIndex}
          pageSize={pageSize}
          totalCount={logPage.totalCount}
          totalPages={logPage.totalPages}
          onPageChange={setPageNumber}
          onPageSizeChange={(value) => {
            setPageSize(value)
            setPageNumber(1)
          }}
        />
      </section>
      {selectedLog ? <AuditLogDetailModal log={selectedLog} onClose={() => setSelectedLog(null)} /> : null}
    </main>
  )
}

function AuditLogDetailModal({ log, onClose }: { log: AuditLogEntry; onClose: () => void }) {
  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <section className="audit-detail-modal" role="dialog" aria-modal="true" aria-label="Audit log detalları" onClick={(event) => event.stopPropagation()}>
        <div className="audit-detail-header">
          <div>
            <span className="eyebrow">Audit detalı</span>
            <h2>{log.actionDisplayName || log.action || 'Əməliyyat'}</h2>
          </div>
          <button type="button" className="ui-button ui-button-secondary action-icon-button" aria-label="Bağla" title="Bağla" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="audit-detail-summary">
          <DetailItem label="Obyekt" value={log.entityDisplayName || `${log.entityName} #${log.entityId}`} />
          <DetailItem label="İstifadəçi" value={log.actorName || 'Sistem'} />
          <DetailItem label="Rol" value={log.actorRoleName || '-'} />
          <DetailItem label="Tarix" value={toLocalDateTime(log.occurredAt || log.createdAt)} />
          {log.actorEmail ? <DetailItem label="Email" value={log.actorEmail} /> : null}
          {log.ipAddress ? <DetailItem label="IP ünvan" value={log.ipAddress} /> : null}
        </div>

        {log.details.length > 0 ? (
          <div className="audit-detail-changes">
            <span className="eyebrow">Dəyişikliklər</span>
            {log.details.map((detail, index) => (
              <div className="audit-detail-change" key={`${detail.label}-${index}`}>
                <strong>{detail.label}</strong>
                {detail.oldValue !== undefined || detail.newValue !== undefined ? (
                  <div className="audit-change-values">
                    <span>{detail.oldValue || '-'}</span>
                    <span aria-hidden="true">→</span>
                    <span>{detail.newValue || '-'}</span>
                  </div>
                ) : (
                  <span>{detail.value || '-'}</span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="online-only">Bu əməliyyat üçün əlavə detal yoxdur.</p>
        )}
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
