import { i18n } from '../../shared/i18n/i18n'
import { useEffect, useMemo, useState } from 'react'
import { Eye, SlidersHorizontal, X } from 'lucide-react'
import type { AuditLogEntry } from '../../entities/types'
import { ecafeApi } from '../../shared/api/ecafeApi'
import { useAuth } from '../../shared/auth/AuthContext'
import { getAccessibleItems } from '../../shared/auth/authz'
import { useAsyncData } from '../../shared/hooks/useAsyncData'
import { Badge } from '../../shared/ui/Badge'
import { SelectField, TextField } from '../../shared/ui/FormField'
import { PageHeader } from '../../shared/ui/PageHeader'
import { PaginationControls } from '../../shared/ui/PaginationControls'
import { RestaurantSelectField } from '../../shared/ui/RestaurantSelectField'
import { getCurrentLanguage } from '../../shared/i18n/i18n'
import { getIntlLocale } from '../../shared/i18n/language'

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

  return date.toLocaleString(getIntlLocale(getCurrentLanguage()), {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function AuditLogPage() {
  const { user } = useAuth()
  const [selectedRestaurantId, setSelectedRestaurantId] = useState('')
  const [pageNumber, setPageNumber] = useState(1)
  const [pageSize, setPageSize] = useState(defaultPageSize)
  const [filters, setFilters] = useState<AuditFilters>(emptyAuditFilters)
  const [draftFilters, setDraftFilters] = useState<AuditFilters>(emptyAuditFilters)
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null)
  const { data: restaurants } = useAsyncData(() => ecafeApi.restaurants.list(), [], [])
  const { data: auditActions } = useAsyncData(() => ecafeApi.lookups.auditActions(), [], [])
  const accessibleRestaurants = useMemo(() => getAccessibleItems(user, restaurants), [restaurants, user])
  const restaurantId = accessibleRestaurants.some((restaurant) => restaurant.id === selectedRestaurantId)
    ? selectedRestaurantId
    : accessibleRestaurants[0]?.id || ''
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
    if (!selectedRestaurantId && accessibleRestaurants[0]) {
      setSelectedRestaurantId(accessibleRestaurants[0].id)
    }
  }, [accessibleRestaurants, selectedRestaurantId])

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
      <PageHeader eyebrow={i18n.t('ui.pages.admin.audit_log_page.admin_c1c224')} title={i18n.t('ui.pages.admin.audit_log_page.audit_loglar_cc413f')} />

      <section className="admin-panel audit-toolbar">
        <RestaurantSelectField
          emptyOption={null}
          label={i18n.t('ui.pages.admin.audit_log_page.restoran_c4df56')}
          onChange={(nextRestaurantId) => resetPageAnd(setSelectedRestaurantId, nextRestaurantId)}
          required
          restaurants={accessibleRestaurants}
          value={restaurantId}
        />
        <div className="filter-popover">
          <button type="button" className="ui-button ui-button-secondary filter-trigger" onClick={openFilterPanel}>
            <SlidersHorizontal size={18} />
            {i18n.t('ui.pages.admin.audit_log_page.filter_638e24')}
          </button>

          {isFilterOpen ? (
            <div className="filter-panel" role="dialog" aria-label={i18n.t('ui.pages.admin.audit_log_page.audit_log_filterleri_db6254')}>
              <span>{i18n.t('ui.pages.admin.audit_log_page.sirala_4437ec')}</span>
              <div className="filter-panel-grid">
                <SelectField
                  label={i18n.t('ui.pages.admin.audit_log_page.emeliyyat_fc71e9')}
                  value={draftFilters.action}
                  onChange={(event) => updateDraftFilter('action', event.target.value)}
                >
                  <option value="">{i18n.t('ui.pages.admin.audit_log_page.butun_emeliyyatlar_eb75b9')}</option>
                  {auditActions.map((auditAction) => (
                    <option key={auditAction.code} value={auditAction.code}>
                      {auditAction.name}
                    </option>
                  ))}
                </SelectField>
                <TextField
                  label={i18n.t('ui.pages.admin.audit_log_page.baslangic_tarixi_3d5f27')}
                  type="date"
                  value={draftFilters.dateFrom}
                  onChange={(event) => updateDraftFilter('dateFrom', event.target.value)}
                />
                <TextField
                  label={i18n.t('ui.pages.admin.audit_log_page.bitme_tarixi_5ab26f')}
                  type="date"
                  value={draftFilters.dateTo}
                  onChange={(event) => updateDraftFilter('dateTo', event.target.value)}
                />
              </div>
              <div className="filter-panel-actions">
                <button type="button" className="ui-button ui-button-secondary" onClick={clearFilters}>{i18n.t('ui.pages.admin.audit_log_page.temizle_1e4f85')}</button>
                <button type="button" className="ui-button ui-button-primary" onClick={applyFilters}>{i18n.t('ui.pages.admin.audit_log_page.tetbiq_et_0c1bd1')}</button>
              </div>
            </div>
          ) : null}
        </div>
      </section>

      <section className="admin-panel">
        <div className="section-heading-row">
          <div>
            <span className="eyebrow">{i18n.t('ui.pages.admin.audit_log_page.siyahi_3d2d8b')}</span>
            <h2>{i18n.t('ui.pages.admin.audit_log_page.emeliyyat_tarixcesi_42b022')}</h2>
          </div>
          <strong>{logPage.totalCount} {i18n.t('ui.pages.admin.audit_log_page.log_836ff1')}</strong>
        </div>
        {isLoading ? <p className="online-only">{i18n.t('ui.pages.admin.audit_log_page.audit_loglar_yuklenir_7a9c49')}</p> : null}
        <div className="compact-list audit-list">
          <div className="audit-list-head" aria-hidden="true">
            <span>{i18n.t('ui.pages.admin.audit_log_page.emeliyyat_fc71e9')}</span>
            <span>{i18n.t('ui.pages.admin.audit_log_page.obyekt_501d24')}</span>
            <span>{i18n.t('ui.pages.admin.audit_log_page.istifadeci_f941f2')}</span>
            <span>{i18n.t('ui.pages.admin.audit_log_page.rol_fb9f51')}</span>
            <span>{i18n.t('ui.pages.admin.audit_log_page.tarix_2dc57a')}</span>
            <span>{i18n.t('ui.pages.admin.audit_log_page.baxis_6d7648')}</span>
          </div>
          {logPage.items.map((log) => (
            <article className="audit-log-row" key={log.id}>
              <div className="audit-action-cell" data-label={i18n.t('ui.pages.admin.audit_log_page.emeliyyat_fc71e9')}>
                <strong>{log.actionDisplayName || log.action || 'Əməliyyat'}</strong>
              </div>
              <small data-label={i18n.t('ui.pages.admin.audit_log_page.obyekt_501d24')}>{log.entityDisplayName || `${log.entityName} #${log.entityId}`}</small>
              <div className="audit-user-cell" data-label={i18n.t('ui.pages.admin.audit_log_page.istifadeci_f941f2')}>
                <Badge tone="info">{log.actorName || 'Sistem'}</Badge>
                {log.actorEmail ? <small>{log.actorEmail}</small> : null}
              </div>
              <small data-label={i18n.t('ui.pages.admin.audit_log_page.rol_fb9f51')}>{log.actorRoleName || '-'}</small>
              <small data-label={i18n.t('ui.pages.admin.audit_log_page.tarix_2dc57a')}>{toLocalDateTime(log.occurredAt || log.createdAt)}</small>
              <button
                type="button"
                className="ui-button ui-button-secondary action-icon-button"
                data-label={i18n.t('ui.pages.admin.audit_log_page.baxis_6d7648')}
                aria-label={`${log.actionDisplayName || log.action || 'Audit log'} detalına bax`}
                title={i18n.t('ui.pages.admin.audit_log_page.detala_bax_16750f')}
                onClick={() => setSelectedLog(log)}
              >
                <Eye size={18} />
              </button>
            </article>
          ))}
          {!isLoading && logPage.items.length === 0 ? <p className="online-only">{i18n.t('ui.pages.admin.audit_log_page.bu_filterlere_uygun_audit_log_tapilmad_8748f8')}</p> : null}
        </div>
        <PaginationControls
          ariaLabel={i18n.t('ui.pages.admin.audit_log_page.audit_log_sehifeleme_155ccc')}
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
      <section className="audit-detail-modal" role="dialog" aria-modal="true" aria-label={i18n.t('ui.pages.admin.audit_log_page.audit_log_detallari_e12561')} onClick={(event) => event.stopPropagation()}>
        <div className="audit-detail-header">
          <div>
            <span className="eyebrow">{i18n.t('ui.pages.admin.audit_log_page.audit_detali_781856')}</span>
            <h2>{log.actionDisplayName || log.action || 'Əməliyyat'}</h2>
          </div>
          <button type="button" className="ui-button ui-button-secondary action-icon-button" aria-label={i18n.t('ui.pages.admin.audit_log_page.bagla_c1cf91')} title={i18n.t('ui.pages.admin.audit_log_page.bagla_c1cf91')} onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="audit-detail-summary">
          <DetailItem label={i18n.t('ui.pages.admin.audit_log_page.obyekt_501d24')} value={log.entityDisplayName || `${log.entityName} #${log.entityId}`} />
          <DetailItem label={i18n.t('ui.pages.admin.audit_log_page.istifadeci_f941f2')} value={log.actorName || 'Sistem'} />
          <DetailItem label={i18n.t('ui.pages.admin.audit_log_page.rol_fb9f51')} value={log.actorRoleName || '-'} />
          <DetailItem label={i18n.t('ui.pages.admin.audit_log_page.tarix_2dc57a')} value={toLocalDateTime(log.occurredAt || log.createdAt)} />
          {log.actorEmail ? <DetailItem label={i18n.t('ui.pages.admin.audit_log_page.email_969ccb')} value={log.actorEmail} /> : null}
          {log.ipAddress ? <DetailItem label={i18n.t('ui.pages.admin.audit_log_page.ip_unvan_5c2ee3')} value={log.ipAddress} /> : null}
        </div>

        {log.details.length > 0 ? (
          <div className="audit-detail-changes">
            <span className="eyebrow">{i18n.t('ui.pages.admin.audit_log_page.deyisiklikler_ec3e2d')}</span>
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
          <p className="online-only">{i18n.t('ui.pages.admin.audit_log_page.bu_emeliyyat_ucun_elave_detal_yoxdur_b66dee')}</p>
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
